import { randomUUID } from "node:crypto";
import { ValidationError } from "../shared/errors.js";
import { nowIso } from "../shared/utils.js";
import {
  ACTIVE_STATUSES,
  assertValidDateRange,
  assertValidTransition,
  detectConflicts
} from "./experiment-validator.js";
import type {
  CreateExperimentInput,
  DateRange,
  ExperimentTimelineEntry,
  ProductSnapshot,
  SeoExperiment,
  SnapshotComparison,
  SnapshotDiffEntry
} from "./experiment-types.js";

const SNAPSHOT_COMPARABLE_FIELDS: Array<keyof ProductSnapshot> = [
  "productName",
  "category",
  "price",
  "salePrice",
  "detailContentHash",
  "adEnabled"
];

/**
 * 실험(상품명/상세페이지/가격/이미지/속성/옵션/광고 상태 변경)을 기록하고 비교한다.
 * 이 클래스는 저장소를 직접 소유하지 않는다 — 호출자(NaverNameSeoTracker 등)가
 * 기존 실험 목록을 전달하면 순수 함수 형태로 새 상태를 계산해 반환한다.
 * 실제 스마트스토어 상품을 자동으로 수정하거나 롤백하지 않는다 (기록/비교 전용).
 */
export class ExperimentManager {
  createExperiment(input: CreateExperimentInput, existing: SeoExperiment[] = []): SeoExperiment {
    if (!input.name.trim()) {
      throw new ValidationError("실험 이름은 비어 있을 수 없습니다.");
    }
    if (!input.productId.trim()) {
      throw new ValidationError("productId는 비어 있을 수 없습니다.");
    }

    if (input.baselinePeriod) {
      assertValidDateRange(input.baselinePeriod, "baselinePeriod");
    }
    if (input.measurementPeriod) {
      assertValidDateRange(input.measurementPeriod, "measurementPeriod");
    }

    const draft: SeoExperiment = {
      id: randomUUID(),
      productId: input.productId,
      name: input.name,
      hypothesis: input.hypothesis,
      status: "DRAFT",
      variableType: input.variableType,
      beforeSnapshot: input.beforeSnapshot,
      afterSnapshot: input.afterSnapshot,
      targetKeywords: input.targetKeywords ?? [],
      baselinePeriod: input.baselinePeriod,
      measurementPeriod: input.measurementPeriod,
      notes: input.notes,
      linkedRankingAnalysisIds: [],
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    const conflicts = detectConflicts(existing, draft);
    if (conflicts.length > 0) {
      throw new ValidationError(
        `같은 상품에서 같은 변수(${draft.variableType})로 이미 진행 중인 실험이 있습니다: ${conflicts
          .map((c) => c.name)
          .join(", ")}`
      );
    }

    return draft;
  }

  /** existing 목록 기준으로 충돌 여부만 확인하고 싶을 때 사용한다 (생성 전 사전 점검용). */
  detectConflicts(existing: SeoExperiment[], candidate: Pick<SeoExperiment, "id" | "productId" | "variableType">) {
    return detectConflicts(existing, candidate);
  }

  startExperiment(experiment: SeoExperiment, at: string = nowIso()): SeoExperiment {
    assertValidTransition(experiment.status, "RUNNING");
    return { ...experiment, status: "RUNNING", startedAt: at, updatedAt: nowIso() };
  }

  scheduleExperiment(experiment: SeoExperiment, at: string = nowIso()): SeoExperiment {
    assertValidTransition(experiment.status, "SCHEDULED");
    return { ...experiment, status: "SCHEDULED", updatedAt: at };
  }

  endExperiment(experiment: SeoExperiment, at: string = nowIso()): SeoExperiment {
    assertValidTransition(experiment.status, "COMPLETED");
    return { ...experiment, status: "COMPLETED", endedAt: at, updatedAt: nowIso() };
  }

  cancelExperiment(experiment: SeoExperiment, at: string = nowIso()): SeoExperiment {
    assertValidTransition(experiment.status, "CANCELLED");
    return { ...experiment, status: "CANCELLED", updatedAt: at };
  }

  rollbackExperiment(experiment: SeoExperiment, at: string = nowIso()): SeoExperiment {
    assertValidTransition(experiment.status, "ROLLED_BACK");
    return { ...experiment, status: "ROLLED_BACK", updatedAt: at };
  }

  setBaselinePeriod(experiment: SeoExperiment, range: DateRange): SeoExperiment {
    assertValidDateRange(range, "baselinePeriod");
    return { ...experiment, baselinePeriod: range, updatedAt: nowIso() };
  }

  setMeasurementPeriod(experiment: SeoExperiment, range: DateRange): SeoExperiment {
    assertValidDateRange(range, "measurementPeriod");
    return { ...experiment, measurementPeriod: range, updatedAt: nowIso() };
  }

  /** Ranking Change Detector 분석 결과를 이 실험에 느슨하게 연결한다 (ID 참조만 저장). */
  linkRankingAnalysis(experiment: SeoExperiment, analysisId: string): SeoExperiment {
    const linked = new Set(experiment.linkedRankingAnalysisIds ?? []);
    linked.add(analysisId);
    return { ...experiment, linkedRankingAnalysisIds: [...linked], updatedAt: nowIso() };
  }

  /** 변경 전/후 스냅샷을 비교해 실제로 바뀐 필드만 뽑아낸다. */
  compareSnapshots(before: ProductSnapshot, after: ProductSnapshot): SnapshotComparison {
    const changedFields: SnapshotDiffEntry[] = [];

    for (const field of SNAPSHOT_COMPARABLE_FIELDS) {
      if (!deepEqual(before[field], after[field])) {
        changedFields.push({ field, before: before[field], after: after[field] });
      }
    }

    if (!deepEqual(before.attributes ?? {}, after.attributes ?? {})) {
      changedFields.push({ field: "attributes", before: before.attributes, after: after.attributes });
    }
    if (!deepEqual(before.imageUrls ?? [], after.imageUrls ?? [])) {
      changedFields.push({ field: "imageUrls", before: before.imageUrls, after: after.imageUrls });
    }

    return { changedFields, hasChanges: changedFields.length > 0 };
  }

  /** 여러 실험의 상태 변화를 시간순 타임라인으로 반환한다. */
  buildTimeline(experiments: SeoExperiment[]): ExperimentTimelineEntry[] {
    const entries: ExperimentTimelineEntry[] = [];

    for (const experiment of experiments) {
      entries.push({
        experimentId: experiment.id,
        name: experiment.name,
        status: "DRAFT",
        at: experiment.createdAt,
        label: "실험 생성"
      });
      if (experiment.startedAt) {
        entries.push({
          experimentId: experiment.id,
          name: experiment.name,
          status: "RUNNING",
          at: experiment.startedAt,
          label: "실험 시작"
        });
      }
      if (experiment.endedAt) {
        entries.push({
          experimentId: experiment.id,
          name: experiment.name,
          status: experiment.status,
          at: experiment.endedAt,
          label: experiment.status === "ROLLED_BACK" ? "롤백됨" : "실험 종료"
        });
      }
    }

    return entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }
}

export function isExperimentActive(experiment: SeoExperiment): boolean {
  return ACTIVE_STATUSES.includes(experiment.status);
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
