import { describe, expect, it } from "vitest";
import { RuleBasedReviewIntelligence } from "../src/reviews/review-intelligence.js";
import { ValidationError } from "../src/shared/errors.js";
import type { ReviewInput } from "../src/reviews/review-types.js";

function review(overrides: Partial<ReviewInput>): ReviewInput {
  return { id: overrides.id ?? Math.random().toString(36), content: "", ...overrides };
}

function findCode(codes: Array<{ code: string }>, code: string) {
  return codes.some((item) => item.code === code);
}

describe("RuleBasedReviewIntelligence", () => {
  const engine = new RuleBasedReviewIntelligence();

  it("빈 배열이면 ValidationError를 던진다", async () => {
    await expect(engine.analyze([])).rejects.toBeInstanceOf(ValidationError);
  });

  it("별점이 높으면 긍정으로 분류한다", async () => {
    const result = await engine.analyze([review({ rating: 5, content: "매우 만족합니다" })]);
    expect(result.details.sentimentBreakdown.positive).toBe(1);
  });

  it("별점이 낮으면 부정으로 분류한다", async () => {
    const result = await engine.analyze([review({ rating: 1, content: "별로예요" })]);
    expect(result.details.sentimentBreakdown.negative).toBe(1);
  });

  it("별점이 없으면 키워드로 감정을 추정한다", async () => {
    const result = await engine.analyze([review({ content: "정말 좋아요 최고입니다" })]);
    expect(result.details.sentimentBreakdown.positive).toBe(1);
  });

  it("부정 리뷰 비중이 높으면 HIGH_NEGATIVE_RATIO 약점을 반환한다", async () => {
    const reviews = Array.from({ length: 5 }, (_, i) => review({ rating: 1, content: `실망했어요 ${i}` }));
    const result = await engine.analyze(reviews);
    expect(findCode(result.weaknesses, "HIGH_NEGATIVE_RATIO")).toBe(true);
  });

  it("긍정 비중이 높으면 MOSTLY_POSITIVE 강점을 반환한다", async () => {
    const reviews = Array.from({ length: 5 }, (_, i) => review({ rating: 5, content: `너무 좋아요 ${i}` }));
    const result = await engine.analyze(reviews);
    expect(findCode(result.strengths, "MOSTLY_POSITIVE")).toBe(true);
  });

  it("짧은 리뷰가 많으면 MANY_SHORT_REVIEWS 약점을 반환한다", async () => {
    const reviews = Array.from({ length: 4 }, () => review({ content: "굿" }));
    const result = await engine.analyze(reviews);
    expect(findCode(result.weaknesses, "MANY_SHORT_REVIEWS")).toBe(true);
    expect(result.details.shortReviewCount).toBe(4);
  });

  it("실사용 지표가 있으면 genuineUsageRatio가 0보다 크다", async () => {
    const reviews = [
      review({
        content: "며칠 사용해보니 배터리도 오래가고 실제로 학습에 도움이 많이 됐어요 아이가 좋아합니다"
      }),
      review({ content: "그냥 그래요" })
    ];
    const result = await engine.analyze(reviews);
    expect(result.details.genuineUsageRatio).toBeGreaterThan(0);
  });

  it("중복 리뷰를 감지한다", async () => {
    const reviews = [review({ content: "완전 좋아요" }), review({ content: "완전 좋아요" }), review({ content: "다른 내용입니다" })];
    const result = await engine.analyze(reviews);
    expect(result.details.duplicateRiskCount).toBeGreaterThan(0);
    expect(findCode(result.weaknesses, "POSSIBLE_DUPLICATE_REVIEWS")).toBe(true);
  });

  it("질문형 리뷰는 faqCandidates에 담긴다", async () => {
    const result = await engine.analyze([review({ content: "이거 세탁기에 돌려도 되나요? 궁금합니다" })]);
    expect(result.details.faqCandidates.length).toBeGreaterThan(0);
    expect(findCode(result.recommendations, "ADD_FAQ_FROM_REVIEWS")).toBe(true);
  });

  it("개선 요구사항이 있는 리뷰는 improvementRequests에 담긴다", async () => {
    const result = await engine.analyze([review({ content: "색상 다양성이 아쉬운 점입니다. 개선되면 좋겠어요" })]);
    expect(result.details.improvementRequests.length).toBeGreaterThan(0);
  });

  it("반복 등장하는 단어를 topics로 추출한다", async () => {
    const reviews = [
      review({ content: "배터리 오래가고 좋아요" }),
      review({ content: "배터리 성능 정말 만족합니다" }),
      review({ content: "디자인도 예뻐요" })
    ];
    const result = await engine.analyze(reviews);
    expect(result.details.topics).toContain("배터리");
  });

  it("LLM 없이도 전체 분석이 정상 동작한다", async () => {
    const result = await engine.analyze([review({ content: "보통이에요" })]);
    expect(result.metadata.llmUsed).toBe(false);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });
});
