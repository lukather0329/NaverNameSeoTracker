export const ENGINE_VERSION = "0.1.0";
export const DEFAULT_RULESET_VERSION = "2026-07-24";

/** 순위/실험 등 통계 분석에서 "표본이 충분하다"고 볼 최소 개수. 이보다 적으면 confidence를 크게 낮춘다. */
export const MIN_SAMPLE_SIZE_FOR_HIGH_CONFIDENCE = 20;
/** 이보다 적으면 분석 자체를 "데이터 부족"으로 취급한다. */
export const MIN_SAMPLE_SIZE_FOR_ANALYSIS = 3;

export const GRADE_THRESHOLDS: ReadonlyArray<{ min: number; grade: "A" | "B" | "C" | "D" | "F" }> = [
  { min: 90, grade: "A" },
  { min: 75, grade: "B" },
  { min: 60, grade: "C" },
  { min: 40, grade: "D" },
  { min: 0, grade: "F" }
];
