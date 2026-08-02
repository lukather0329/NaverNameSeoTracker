import { ConflictError, ValidationError } from "../shared/errors.js";
import type { DateRange, ExperimentStatus, SeoExperiment } from "./experiment-types.js";

const VALID_TRANSITIONS: Record<ExperimentStatus, ExperimentStatus[]> = {
  DRAFT: ["SCHEDULED", "RUNNING", "CANCELLED"],
  SCHEDULED: ["RUNNING", "CANCELLED"],
  RUNNING: ["COMPLETED", "CANCELLED", "ROLLED_BACK"],
  COMPLETED: ["ROLLED_BACK"],
  CANCELLED: [],
  ROLLED_BACK: []
};

export const ACTIVE_STATUSES: ExperimentStatus[] = ["SCHEDULED", "RUNNING"];

export function assertValidTransition(from: ExperimentStatus, to: ExperimentStatus): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new ConflictError(`상태 전이가 허용되지 않습니다: ${from} -> ${to}`);
  }
}

export function isTerminalStatus(status: ExperimentStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}

/**
 * 같은 상품(productId)에서 같은 변수 타입으로 동시에 진행 중(SCHEDULED/RUNNING)인
 * 실험이 있는지 감지한다. 여러 변수를 동시에 바꾸면 원인 분석이 불가능해지기 때문에
 * Ranking Change Detector가 원인 후보를 판단하기 전에 먼저 걸러야 한다.
 */
export function detectConflicts(
  existing: SeoExperiment[],
  candidate: Pick<SeoExperiment, "productId" | "variableType" | "id">
): SeoExperiment[] {
  return existing.filter(
    (experiment) =>
      experiment.id !== candidate.id &&
      experiment.productId === candidate.productId &&
      experiment.variableType === candidate.variableType &&
      ACTIVE_STATUSES.includes(experiment.status)
  );
}

export function assertValidDateRange(range: DateRange, fieldName: string): void {
  const start = new Date(range.start).getTime();
  const end = new Date(range.end).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) {
    throw new ValidationError(`${fieldName}의 날짜 형식이 올바르지 않습니다.`);
  }
  if (start >= end) {
    throw new ValidationError(`${fieldName}의 시작일은 종료일보다 이전이어야 합니다.`);
  }
}
