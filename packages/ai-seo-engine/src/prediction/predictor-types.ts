export type SeoActionType =
  | "CHANGE_PRODUCT_NAME"
  | "ADD_FAQ"
  | "IMPROVE_CONTENT"
  | "ADD_ATTRIBUTES"
  | "IMPROVE_REVIEWS"
  | "CHANGE_PRICE"
  | "CHANGE_IMAGE";

export interface SeoActionScenario {
  action: SeoActionType;

  estimatedImpactRange: {
    min: number;
    max: number;
  };

  probabilityDistribution?: {
    mean: number;
    standardDeviation: number;
  };

  cost?: number;
  durationDays?: number;
}

export type PredictionRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface ScenarioPrediction {
  action: string;
  probabilityOfImprovement: number;
  expectedRankDelta: number;
  confidenceInterval: [number, number];
  riskLevel: PredictionRiskLevel;
}

/**
 * 이번 단계에서는 실제 순위 예측 정확도를 주장하지 않는다.
 * 향후 구현 시 이미 만들어진 rw_decision_engine(Monte Carlo)의 시뮬레이션 결과를
 * 이 형태로 매핑하는 어댑터로 연결할 수 있다.
 */
export interface PredictionResult {
  simulations: number;

  scenarios: ScenarioPrediction[];

  assumptions: string[];
  warnings: string[];
}
