export interface ReviewRulesConfig {
  shortReviewMaxLength: number;
  genuineUsageMinLength: number;
  positiveTerms: string[];
  negativeTerms: string[];
  usageIndicatorTerms: string[];
  questionIndicatorTerms: string[];
  improvementIndicatorTerms: string[];
}

export const DEFAULT_REVIEW_RULES: ReviewRulesConfig = {
  shortReviewMaxLength: 10,
  genuineUsageMinLength: 30,
  positiveTerms: ["좋아요", "만족", "최고", "추천", "튼튼", "빠른", "편해요", "예뻐요", "굿"],
  negativeTerms: ["별로", "실망", "불편", "느려", "고장", "환불", "최악", "아쉬워요"],
  usageIndicatorTerms: ["사용해보니", "써보니", "실제로", "며칠 써보니", "사용 후기", "받아보니"],
  questionIndicatorTerms: ["문의", "궁금", "질문", "?"],
  improvementIndicatorTerms: ["아쉬운", "개선", "부족", "별로", "불편", "했으면"]
};

export function mergeReviewRules(overrides?: Partial<ReviewRulesConfig>): ReviewRulesConfig {
  return { ...DEFAULT_REVIEW_RULES, ...overrides };
}
