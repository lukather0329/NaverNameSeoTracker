import type { AnalysisResult } from "../shared/types.js";

export interface AuthorityInput {
  sellerName?: string;
  brandName?: string;
  products?: Array<{
    category?: string;
    productName: string;
  }>;
  externalContents?: Array<{
    source: string;
    title: string;
    text?: string;
    publishedAt?: string;
  }>;
}

/**
 * 향후 구현 예정 항목 (이번 단계에서는 타입만 정의):
 * - 카테고리 집중도 (categoryFocusScore)
 * - 브랜드 메시지 일관성 (brandConsistencyScore)
 * - 상품군 전문성 (categoryExpertiseScore)
 * - 외부 콘텐츠 일관성 (externalConsistencyScore)
 * - 브랜드명 언급 빈도 (brandMentionCount)
 * - 제품 설명 전문성 (descriptionExpertiseScore)
 * - 리뷰 내 전문 용어 (expertTermsInReviews)
 * - 홈페이지/블로그/뉴스 간 정보 일치 (crossSourceConsistencyScore)
 *
 * 주의: 이 점수는 네이버 공식 Authority 점수가 아니라 공개 데이터에 기반한 내부 추정치다.
 */
export interface AuthorityScoreDetails {
  categoryFocusScore: number | null;
  brandConsistencyScore: number | null;
  categoryExpertiseScore: number | null;
  externalConsistencyScore: number | null;
  brandMentionCount: number;
  descriptionExpertiseScore: number | null;
  expertTermsInReviews: string[];
  crossSourceConsistencyScore: number | null;
}

export type AuthorityScoreResult = AnalysisResult<AuthorityScoreDetails>;
