import type { PredictionResult, SeoActionScenario } from "./predictor-types.js";

/**
 * Monte Carlo Predictor 엔진 인터페이스. 이번 1차 개발 범위에서는 완성하지 않는다.
 * 실제 구현체는 별도 저장소의 rw_decision_engine(몬테카를로 시뮬레이션 엔진, Python/FastAPI)을
 * HTTP로 호출하거나, 동일한 통계 모델을 TypeScript로 재구현해 이 인터페이스를 채울 수 있다.
 * 어떤 경우든 "정확한 순위 예측"이 아니라 확률적 추정치(probabilityOfImprovement 등)로 표현해야 한다.
 */
export interface MonteCarloPredictor {
  predict(scenarios: SeoActionScenario[], context?: unknown): Promise<PredictionResult>;
}
