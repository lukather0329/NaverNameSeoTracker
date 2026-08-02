import { describe, expect, it } from "vitest";
import { scoreToGrade, normalizeToScore, invertToScore } from "../src/scoring/score-normalizer.js";
import { computeWeightedScore } from "../src/scoring/weighted-score.js";
import { computeConfidence, sampleSizeToConfidenceFactor } from "../src/scoring/confidence-score.js";

describe("score-normalizer", () => {
  it("맵핑 경계값에서 올바른 등급을 반환한다", () => {
    expect(scoreToGrade(95)).toBe("A");
    expect(scoreToGrade(90)).toBe("A");
    expect(scoreToGrade(89)).toBe("B");
    expect(scoreToGrade(60)).toBe("C");
    expect(scoreToGrade(40)).toBe("D");
    expect(scoreToGrade(0)).toBe("F");
    expect(scoreToGrade(-10)).toBe("F");
  });

  it("normalizeToScore는 범위를 0~100으로 정규화한다", () => {
    expect(normalizeToScore(50, 0, 100)).toBe(50);
    expect(normalizeToScore(0, 0, 100)).toBe(0);
    expect(normalizeToScore(150, 0, 100)).toBe(100);
    expect(normalizeToScore(-10, 0, 100)).toBe(0);
  });

  it("invertToScore는 값이 클수록 낮은 점수를 반환한다", () => {
    expect(invertToScore(0, 0, 100)).toBe(100);
    expect(invertToScore(100, 0, 100)).toBe(0);
  });
});

describe("weighted-score", () => {
  it("가중 평균을 정확히 계산한다", () => {
    const score = computeWeightedScore({ a: 100, b: 0 }, { a: 0.5, b: 0.5 });
    expect(score).toBe(50);
  });

  it("componentScores에 없는 weight 키는 무시한다", () => {
    const score = computeWeightedScore({ a: 100 }, { a: 1, b: 1 });
    expect(score).toBe(100);
  });

  it("가중치 합이 1이 아니어도 정규화해서 계산한다", () => {
    const score = computeWeightedScore({ a: 80, b: 40 }, { a: 2, b: 2 });
    expect(score).toBe(60);
  });
});

describe("confidence-score", () => {
  it("모든 요소가 제공되면 0~1 사이 값을 반환한다", () => {
    const confidence = computeConfidence({
      inputCompleteness: 1,
      sampleSize: 50,
      missingRate: 0,
      ruleApplicability: 1,
      llmRuleAgreement: 1,
      periodAdequacy: 1
    });
    expect(confidence).toBeGreaterThan(0.9);
    expect(confidence).toBeLessThanOrEqual(1);
  });

  it("요소가 하나도 없으면 기본 낮은 신뢰도를 반환한다", () => {
    expect(computeConfidence({})).toBe(0.3);
  });

  it("sampleSizeToConfidenceFactor는 표본이 적으면 0에 가깝다", () => {
    expect(sampleSizeToConfidenceFactor(1)).toBe(0);
    expect(sampleSizeToConfidenceFactor(100)).toBe(1);
  });
});
