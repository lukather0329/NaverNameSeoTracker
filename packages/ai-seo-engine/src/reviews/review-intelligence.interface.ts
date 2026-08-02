import type { AnalysisResult } from "../shared/types.js";
import type { ReviewInput, ReviewIntelligenceDetails } from "./review-types.js";

/**
 * 리뷰 분석 엔진 인터페이스. 이번 1차 개발 범위에서는 완성하지 않으며,
 * 향후 구현체가 이 인터페이스를 따르도록 확장 지점만 미리 정의한다.
 */
export interface ReviewIntelligence {
  analyze(reviews: ReviewInput[]): Promise<AnalysisResult<ReviewIntelligenceDetails>>;
}
