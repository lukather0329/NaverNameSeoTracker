import type { AnalysisResult } from "../shared/types.js";

export interface ReviewInput {
  id: string;
  rating?: number;
  content: string;
  createdAt?: string;
  optionName?: string;
}

/**
 * 향후 구현 시 채울 상세 분석 항목. 이번 단계에서는 타입만 정의하고 실제 계산 로직은 없다.
 * 예정된 분석 항목:
 * - 리뷰 정보량 (volume)
 * - 긍정/부정 감정 분포 (sentimentBreakdown)
 * - 주요 주제 (topics)
 * - 실제 사용 경험 여부 (genuineUsageRatio)
 * - 중복 리뷰 가능성 (duplicateRiskCount)
 * - 지나치게 짧은 리뷰 (shortReviewCount)
 * - 제품 속성 언급 (mentionedAttributes)
 * - FAQ 후보 추출 (faqCandidates)
 * - 개선 요구사항 추출 (improvementRequests)
 */
export interface ReviewIntelligenceDetails {
  volume: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  topics: string[];
  genuineUsageRatio: number | null;
  duplicateRiskCount: number;
  shortReviewCount: number;
  mentionedAttributes: string[];
  faqCandidates: string[];
  improvementRequests: string[];
}

export type ReviewIntelligenceResult = AnalysisResult<ReviewIntelligenceDetails>;
