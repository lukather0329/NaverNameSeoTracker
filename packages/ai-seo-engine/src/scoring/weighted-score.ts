import { clamp, round } from "../shared/utils.js";

/**
 * 엔진별 가중치 설정. 각 값은 항목별 가중치(합이 1이 아니어도 내부적으로 정규화된다).
 * 설정 파일 또는 런타임에서 주입해 하드코딩 없이 조정할 수 있게 한다.
 */
export interface ScoringConfig {
  semantic: Record<string, number>;
  content: Record<string, number>;
  ranking: Record<string, number>;
}

/**
 * 항목별 점수(componentScores, 0~100)와 가중치(weights)를 받아 최종 0~100 점수를 계산한다.
 * componentScores에 없는 weight 키는 무시하고, weights에 없는 componentScores 키도 무시한다.
 * 가중치 합이 1이 아니면 자동으로 정규화한다.
 */
export function computeWeightedScore(componentScores: Record<string, number>, weights: Record<string, number>): number {
  const keys = Object.keys(weights).filter((key) => key in componentScores);

  if (keys.length === 0) {
    return 0;
  }

  const totalWeight = keys.reduce((sum, key) => sum + (weights[key] ?? 0), 0);

  if (totalWeight <= 0) {
    return 0;
  }

  const weightedSum = keys.reduce((sum, key) => {
    const weight = (weights[key] ?? 0) / totalWeight;
    return sum + weight * clamp(componentScores[key] ?? 0, 0, 100);
  }, 0);

  return round(clamp(weightedSum, 0, 100));
}

export const DEFAULT_SEMANTIC_WEIGHTS: Record<string, number> = {
  clarity: 0.25,
  productTypePresence: 0.2,
  keywordCoverage: 0.2,
  categoryAlignment: 0.15,
  readability: 0.1,
  duplicationPenalty: 0.05,
  promotionalPenalty: 0.05
};

export const DEFAULT_CONTENT_WEIGHTS: Record<string, number> = {
  completeness: 0.3,
  structure: 0.2,
  readability: 0.15,
  keywordCoverage: 0.15,
  titleContentConsistency: 0.1,
  imageTextBalance: 0.1
};

export const DEFAULT_RANKING_WEIGHTS: Record<string, number> = {
  rankImprovement: 0.5,
  trendStability: 0.3,
  sampleAdequacy: 0.2
};

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  semantic: DEFAULT_SEMANTIC_WEIGHTS,
  content: DEFAULT_CONTENT_WEIGHTS,
  ranking: DEFAULT_RANKING_WEIGHTS
};
