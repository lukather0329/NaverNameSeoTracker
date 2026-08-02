import { MIN_SAMPLE_SIZE_FOR_ANALYSIS, MIN_SAMPLE_SIZE_FOR_HIGH_CONFIDENCE } from "../shared/constants.js";
import { clamp, round } from "../shared/utils.js";

/**
 * 분석 신뢰도를 구성하는 요소. 점수(score)와 신뢰도(confidence)는 별개 개념이다:
 * 입력이 빈약해도 점수는 계산될 수 있지만, 그 점수를 얼마나 믿을 수 있는지는 낮게 나와야 한다.
 * 모든 필드는 선택값이며, 제공되지 않은 요소는 신뢰도 계산에서 제외된다(가중치 재정규화).
 */
export interface ConfidenceFactors {
  /** 입력 데이터 완성도 (0~1). 필수 필드 대비 채워진 필드 비율 등. */
  inputCompleteness?: number;
  /** 표본 수 (순위 관측치, 리뷰 개수 등). */
  sampleSize?: number;
  /** 데이터 누락률 (0~1, 높을수록 나쁨). */
  missingRate?: number;
  /** 규칙 기반 분석이 실제로 적용 가능했던 비율 (0~1). */
  ruleApplicability?: number;
  /** LLM 결과와 규칙 기반 결과의 일치도 (0~1). LLM을 사용하지 않았다면 undefined. */
  llmRuleAgreement?: number;
  /** 비교 기간(관측 기간)의 적절성 (0~1). */
  periodAdequacy?: number;
}

const FACTOR_WEIGHTS: Record<keyof ConfidenceFactors, number> = {
  inputCompleteness: 0.25,
  sampleSize: 0.25,
  missingRate: 0.15,
  ruleApplicability: 0.15,
  llmRuleAgreement: 0.1,
  periodAdequacy: 0.1
};

/** 표본 수를 0~1 신뢰 요소로 변환한다. MIN_SAMPLE_SIZE_FOR_HIGH_CONFIDENCE 이상이면 1에 가깝다. */
export function sampleSizeToConfidenceFactor(sampleSize: number): number {
  if (sampleSize < MIN_SAMPLE_SIZE_FOR_ANALYSIS) {
    return 0;
  }
  return clamp(sampleSize / MIN_SAMPLE_SIZE_FOR_HIGH_CONFIDENCE, 0, 1);
}

/**
 * 여러 신뢰도 요소를 하나의 confidence(0~1)로 합성한다.
 * 제공되지 않은 요소는 가중치 계산에서 제외하고 나머지 가중치를 재정규화한다.
 */
export function computeConfidence(factors: ConfidenceFactors): number {
  const normalizedFactors: Partial<Record<keyof ConfidenceFactors, number>> = { ...factors };

  if (typeof normalizedFactors.sampleSize === "number") {
    normalizedFactors.sampleSize = sampleSizeToConfidenceFactor(normalizedFactors.sampleSize);
  }
  if (typeof normalizedFactors.missingRate === "number") {
    normalizedFactors.missingRate = clamp(1 - normalizedFactors.missingRate, 0, 1);
  }

  const keys = Object.keys(FACTOR_WEIGHTS).filter(
    (key) => typeof normalizedFactors[key as keyof ConfidenceFactors] === "number"
  ) as Array<keyof ConfidenceFactors>;

  if (keys.length === 0) {
    return 0.3;
  }

  const totalWeight = keys.reduce((sum, key) => sum + FACTOR_WEIGHTS[key], 0);
  const weightedSum = keys.reduce((sum, key) => {
    const weight = FACTOR_WEIGHTS[key] / totalWeight;
    return sum + weight * clamp(normalizedFactors[key] as number, 0, 1);
  }, 0);

  return round(clamp(weightedSum, 0, 1), 2);
}
