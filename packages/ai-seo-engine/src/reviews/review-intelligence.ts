import { computeConfidence } from "../scoring/confidence-score.js";
import { scoreToGrade } from "../scoring/score-normalizer.js";
import { ENGINE_VERSION } from "../shared/constants.js";
import { ValidationError } from "../shared/errors.js";
import type { AnalysisFinding, AnalysisResult, Recommendation } from "../shared/types.js";
import { clamp, hashInput, nowIso, round } from "../shared/utils.js";
import { DEFAULT_REVIEW_RULES, mergeReviewRules, type ReviewRulesConfig } from "./review-rules.js";
import type { ReviewInput, ReviewIntelligenceDetails } from "./review-types.js";
import type { ReviewIntelligence as ReviewIntelligenceInterface } from "./review-intelligence.interface.js";

export interface ReviewIntelligenceOptions {
  rules?: Partial<ReviewRulesConfig>;
}

const RULESET_VERSION = "review-rules@1";

/**
 * 리뷰 배열을 규칙 기반으로 분석한다. 감정 분석은 별점(있으면 우선)과 키워드 매칭을 함께
 * 사용하는 단순 휴리스틱이며, 정교한 NLP 감정분석 모델이 아니다.
 */
export class RuleBasedReviewIntelligence implements ReviewIntelligenceInterface {
  private readonly rules: ReviewRulesConfig;

  constructor(options: ReviewIntelligenceOptions = {}) {
    this.rules = mergeReviewRules(options.rules);
  }

  async analyze(reviews: ReviewInput[]): Promise<AnalysisResult<ReviewIntelligenceDetails>> {
    if (!Array.isArray(reviews) || reviews.length === 0) {
      throw new ValidationError("reviews는 비어 있지 않은 배열이어야 합니다.");
    }

    const strengths: AnalysisFinding[] = [];
    const weaknesses: AnalysisFinding[] = [];
    const recommendations: Recommendation[] = [];

    const volume = reviews.length;

    let positive = 0;
    let neutral = 0;
    let negative = 0;
    let genuineUsageCount = 0;
    let shortReviewCount = 0;
    const faqCandidates: string[] = [];
    const improvementRequests: string[] = [];
    const contentCounts = new Map<string, number>();

    for (const review of reviews) {
      const content = review.content ?? "";
      const sentiment = classifySentiment(review, this.rules);
      if (sentiment === "positive") positive += 1;
      else if (sentiment === "negative") negative += 1;
      else neutral += 1;

      if (content.trim().length <= this.rules.shortReviewMaxLength) {
        shortReviewCount += 1;
      }
      if (
        content.length >= this.rules.genuineUsageMinLength &&
        this.rules.usageIndicatorTerms.some((term) => content.includes(term))
      ) {
        genuineUsageCount += 1;
      }
      if (this.rules.questionIndicatorTerms.some((term) => content.includes(term))) {
        faqCandidates.push(content.slice(0, 120));
      }
      if (this.rules.improvementIndicatorTerms.some((term) => content.includes(term))) {
        improvementRequests.push(content.slice(0, 120));
      }

      const normalized = content.trim().toLowerCase();
      if (normalized.length > 0) {
        contentCounts.set(normalized, (contentCounts.get(normalized) ?? 0) + 1);
      }
    }

    const duplicateRiskCount = [...contentCounts.values()].filter((count) => count >= 2).length;
    const genuineUsageRatio = volume > 0 ? round(genuineUsageCount / volume) : null;
    const topics = extractTopics(reviews.map((r) => r.content ?? ""));

    if (positive / volume >= 0.7) {
      strengths.push({
        code: "MOSTLY_POSITIVE",
        title: "긍정적인 리뷰 비중이 높습니다",
        description: `전체 ${volume}건 중 긍정 추정 ${positive}건`
      });
    }
    if (negative / volume >= 0.3) {
      weaknesses.push({
        code: "HIGH_NEGATIVE_RATIO",
        title: "부정적인 리뷰 비중이 높습니다",
        description: `전체 ${volume}건 중 부정 추정 ${negative}건`
      });
      recommendations.push({
        code: "REVIEW_NEGATIVE_FEEDBACK",
        priority: "HIGH",
        title: "부정 리뷰 내용을 점검하세요",
        description: "improvementRequests 목록을 참고해 자주 언급되는 불만을 먼저 개선하세요."
      });
    }
    if (shortReviewCount / volume >= 0.5) {
      weaknesses.push({
        code: "MANY_SHORT_REVIEWS",
        title: "짧은 리뷰가 많습니다",
        description: `전체 ${volume}건 중 ${shortReviewCount}건이 ${this.rules.shortReviewMaxLength}자 이하`
      });
    }
    if (duplicateRiskCount > 0) {
      weaknesses.push({
        code: "POSSIBLE_DUPLICATE_REVIEWS",
        title: "중복 가능성이 있는 리뷰가 있습니다",
        description: `동일/유사 내용 ${duplicateRiskCount}건`
      });
    }
    if (faqCandidates.length > 0) {
      recommendations.push({
        code: "ADD_FAQ_FROM_REVIEWS",
        priority: "MEDIUM",
        title: "리뷰의 질문을 FAQ로 정리하세요",
        description: `질문형 리뷰 ${faqCandidates.length}건을 상세페이지 FAQ 섹션에 반영해보세요.`
      });
    }

    const volumeScore = clamp(round((Math.min(volume, 50) / 50) * 100), 0, 100);
    const sentimentScore = clamp(round(((positive - negative) / volume) * 50 + 50), 0, 100);
    const qualityScore = clamp(round(100 - (shortReviewCount / volume) * 50 - (duplicateRiskCount / volume) * 50), 0, 100);
    const score = round(volumeScore * 0.3 + sentimentScore * 0.5 + qualityScore * 0.2);

    const confidence = computeConfidence({
      sampleSize: volume,
      inputCompleteness: reviews.some((r) => typeof r.rating === "number") ? 1 : 0.6
    });

    const details: ReviewIntelligenceDetails = {
      volume,
      sentimentBreakdown: { positive, neutral, negative },
      topics,
      genuineUsageRatio,
      duplicateRiskCount,
      shortReviewCount,
      mentionedAttributes: [],
      faqCandidates: faqCandidates.slice(0, 10),
      improvementRequests: improvementRequests.slice(0, 10)
    };

    return {
      score,
      grade: scoreToGrade(score),
      confidence,
      summary: `리뷰 ${volume}건 분석 - 긍정 ${positive} / 중립 ${neutral} / 부정 ${negative} (점수 ${score}점)`,
      strengths,
      weaknesses,
      recommendations,
      details,
      metadata: {
        engineVersion: ENGINE_VERSION,
        analyzedAt: nowIso(),
        inputHash: hashInput(reviews),
        rulesetVersion: RULESET_VERSION,
        llmUsed: false
      }
    };
  }
}

function classifySentiment(review: ReviewInput, rules: ReviewRulesConfig): "positive" | "neutral" | "negative" {
  if (typeof review.rating === "number") {
    if (review.rating >= 4) return "positive";
    if (review.rating <= 2) return "negative";
    return "neutral";
  }

  const content = review.content ?? "";
  const hasPositive = rules.positiveTerms.some((term) => content.includes(term));
  const hasNegative = rules.negativeTerms.some((term) => content.includes(term));

  if (hasPositive && !hasNegative) return "positive";
  if (hasNegative && !hasPositive) return "negative";
  return "neutral";
}

const STOPWORDS = new Set(["그리고", "정말", "너무", "제품", "상품", "그냥", "진짜", "이제", "그런데", "하지만"]);

function extractTopics(contents: string[]): string[] {
  const counts = new Map<string, number>();
  for (const content of contents) {
    const words = content.split(/[\s,.!?~()]+/).filter((word) => word.length >= 2 && !STOPWORDS.has(word));
    for (const word of words) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}
