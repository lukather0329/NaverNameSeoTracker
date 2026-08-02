import { describe, expect, it } from "vitest";
import { ExperimentManager } from "../src/experiments/experiment-manager.js";
import { ConflictError, ValidationError } from "../src/shared/errors.js";
import type { CreateExperimentInput } from "../src/experiments/experiment-types.js";

function baseInput(overrides: Partial<CreateExperimentInput> = {}): CreateExperimentInput {
  return {
    productId: "product-1",
    name: "상품명 SEO 테스트",
    hypothesis: "핵심 키워드를 추가하면 순위가 개선될 것이다",
    variableType: "PRODUCT_NAME",
    beforeSnapshot: { productName: "허밍버드PRO" },
    afterSnapshot: { productName: "허밍버드PRO 교육용 코딩드론" },
    ...overrides
  };
}

describe("ExperimentManager", () => {
  const manager = new ExperimentManager();

  it("실험을 생성하면 DRAFT 상태로 시작한다", () => {
    const experiment = manager.createExperiment(baseInput());
    expect(experiment.status).toBe("DRAFT");
    expect(experiment.id).toBeTruthy();
  });

  it("이름이 비어 있으면 ValidationError를 던진다", () => {
    expect(() => manager.createExperiment(baseInput({ name: "" }))).toThrow(ValidationError);
  });

  it("같은 상품 + 같은 변수 타입의 진행 중인 실험이 있으면 생성을 거부한다", () => {
    const first = manager.startExperiment(manager.createExperiment(baseInput()));
    expect(() => manager.createExperiment(baseInput(), [first])).toThrow(ValidationError);
  });

  it("DRAFT -> RUNNING -> COMPLETED 전이가 정상 동작한다", () => {
    let experiment = manager.createExperiment(baseInput());
    experiment = manager.startExperiment(experiment);
    expect(experiment.status).toBe("RUNNING");
    expect(experiment.startedAt).toBeTruthy();

    experiment = manager.endExperiment(experiment);
    expect(experiment.status).toBe("COMPLETED");
    expect(experiment.endedAt).toBeTruthy();
  });

  it("허용되지 않은 상태 전이는 ConflictError를 던진다", () => {
    let experiment = manager.createExperiment(baseInput());
    experiment = manager.startExperiment(experiment);
    experiment = manager.endExperiment(experiment);
    expect(() => manager.startExperiment(experiment)).toThrow(ConflictError);
  });

  it("실험을 취소할 수 있다", () => {
    const experiment = manager.cancelExperiment(manager.createExperiment(baseInput()));
    expect(experiment.status).toBe("CANCELLED");
  });

  it("완료된 실험을 롤백 상태로 기록할 수 있다", () => {
    let experiment = manager.createExperiment(baseInput());
    experiment = manager.startExperiment(experiment);
    experiment = manager.endExperiment(experiment);
    experiment = manager.rollbackExperiment(experiment);
    expect(experiment.status).toBe("ROLLED_BACK");
  });

  it("compareSnapshots는 변경된 필드만 반환한다", () => {
    const comparison = manager.compareSnapshots(
      { productName: "A", price: 1000 },
      { productName: "B", price: 1000 }
    );
    expect(comparison.hasChanges).toBe(true);
    expect(comparison.changedFields.map((f) => f.field)).toContain("productName");
    expect(comparison.changedFields.map((f) => f.field)).not.toContain("price");
  });

  it("compareSnapshots는 변경이 없으면 hasChanges=false를 반환한다", () => {
    const comparison = manager.compareSnapshots({ productName: "A" }, { productName: "A" });
    expect(comparison.hasChanges).toBe(false);
  });

  it("buildTimeline은 시간순으로 이벤트를 정렬한다", () => {
    let experiment = manager.createExperiment(baseInput());
    experiment = manager.startExperiment(experiment);
    experiment = manager.endExperiment(experiment);

    const timeline = manager.buildTimeline([experiment]);
    expect(timeline.length).toBeGreaterThanOrEqual(2);
    const times = timeline.map((entry) => new Date(entry.at).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("setBaselinePeriod는 잘못된 날짜 범위에 ValidationError를 던진다", () => {
    const experiment = manager.createExperiment(baseInput());
    expect(() =>
      manager.setBaselinePeriod(experiment, { start: "2026-01-10", end: "2026-01-01" })
    ).toThrow(ValidationError);
  });

  it("linkRankingAnalysis는 분석 ID를 중복 없이 추가한다", () => {
    let experiment = manager.createExperiment(baseInput());
    experiment = manager.linkRankingAnalysis(experiment, "analysis-1");
    experiment = manager.linkRankingAnalysis(experiment, "analysis-1");
    expect(experiment.linkedRankingAnalysisIds).toEqual(["analysis-1"]);
  });
});
