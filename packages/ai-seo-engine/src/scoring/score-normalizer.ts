import { GRADE_THRESHOLDS } from "../shared/constants.js";
import type { Grade } from "../shared/types.js";
import { clamp, round } from "../shared/utils.js";

/** 0~100 점수를 A~F 등급으로 변환한다. */
export function scoreToGrade(score: number): Grade {
  const clamped = clamp(score, 0, 100);
  for (const threshold of GRADE_THRESHOLDS) {
    if (clamped >= threshold.min) {
      return threshold.grade;
    }
  }
  return "F";
}

/** 임의 범위의 원시 값을 0~100 점수로 정규화한다. */
export function normalizeToScore(value: number, min: number, max: number): number {
  if (max <= min) {
    return 0;
  }
  const ratio = (value - min) / (max - min);
  return round(clamp(ratio * 100, 0, 100));
}

/** 값이 클수록 나쁜 지표(예: 중복 횟수)를 점수로 뒤집어 정규화한다. */
export function invertToScore(value: number, min: number, max: number): number {
  return round(100 - normalizeToScore(value, min, max));
}
