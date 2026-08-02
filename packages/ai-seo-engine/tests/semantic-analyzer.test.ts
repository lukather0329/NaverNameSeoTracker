import { describe, expect, it } from "vitest";
import { SemanticAnalyzer } from "../src/semantic/semantic-analyzer.js";
import { ValidationError } from "../src/shared/errors.js";

function findCode(codes: Array<{ code: string }>, code: string) {
  return codes.some((item) => item.code === code);
}

describe("SemanticAnalyzer", () => {
  const analyzer = new SemanticAnalyzer();

  it("브랜드명만 있는 상품명은 BRAND_ONLY_NAME 약점을 갖는다", async () => {
    const result = await analyzer.analyze({ productName: "메이크웨어", brand: "메이크웨어" });
    expect(findCode(result.weaknesses, "BRAND_ONLY_NAME")).toBe(true);
    expect(result.score).toBeLessThan(60);
  });

  it("키워드가 과다 반복된 상품명은 DUPLICATED_TERMS를 감지한다", async () => {
    const result = await analyzer.analyze({ productName: "드론 드론 드론 코딩 드론 세트" });
    expect(findCode(result.weaknesses, "DUPLICATED_TERMS")).toBe(true);
  });

  it("광고 문구가 과도한 상품명은 PROMOTIONAL_LANGUAGE를 감지한다", async () => {
    const result = await analyzer.analyze({ productName: "역대급 초특가 1위 베스트 코딩드론 세트 완전대박" });
    expect(findCode(result.weaknesses, "PROMOTIONAL_LANGUAGE")).toBe(true);
    expect(result.details.suspiciousTerms.length).toBeGreaterThan(0);
  });

  it("제품 유형이 명확한 상품명은 PRODUCT_TYPE_UNCLEAR가 없다", async () => {
    const result = await analyzer.analyze({
      productName: "허밍버드PRO 교육용 코딩드론 파이썬 세트",
      brand: "메이크웨어",
      category: "교육용 코딩드론"
    });
    expect(findCode(result.weaknesses, "PRODUCT_TYPE_UNCLEAR")).toBe(false);
  });

  it("목표 키워드 일부가 누락되면 MISSING_TARGET_KEYWORDS를 반환한다", async () => {
    const result = await analyzer.analyze({
      productName: "허밍버드PRO 코딩드론",
      targetKeywords: ["코딩드론", "파이썬", "교육용 드론", "AI 드론"]
    });
    expect(result.details.missingKeywords).toContain("파이썬");
    expect(findCode(result.weaknesses, "MISSING_TARGET_KEYWORDS")).toBe(true);
  });

  it("특수문자가 과도하면 EXCESSIVE_SPECIAL_CHARS를 반환한다", async () => {
    const result = await analyzer.analyze({ productName: "★★★!!!@@@###코딩드론###!!!★★★" });
    expect(findCode(result.weaknesses, "EXCESSIVE_SPECIAL_CHARS")).toBe(true);
  });

  it("지나치게 긴 상품명은 NAME_TOO_LONG을 반환한다", async () => {
    const longName = "코딩드론 " + "고급형 프리미엄 에디션 ".repeat(10);
    const result = await analyzer.analyze({ productName: longName });
    expect(findCode(result.weaknesses, "NAME_TOO_LONG")).toBe(true);
  });

  it("지나치게 짧은 상품명은 NAME_TOO_SHORT를 반환한다", async () => {
    const result = await analyzer.analyze({ productName: "드론" });
    expect(findCode(result.weaknesses, "NAME_TOO_SHORT")).toBe(true);
  });

  it("금지 키워드가 포함되면 PROHIBITED_KEYWORDS_FOUND를 반환한다", async () => {
    const result = await analyzer.analyze({
      productName: "짝퉁 명품 스타일 코딩드론",
      prohibitedKeywords: ["짝퉁"]
    });
    expect(findCode(result.weaknesses, "PROHIBITED_KEYWORDS_FOUND")).toBe(true);
  });

  it("카테고리와 상품명이 불일치하면 CATEGORY_MISMATCH를 반환한다", async () => {
    const result = await analyzer.analyze({
      productName: "허밍버드PRO 무선 이어폰",
      category: "교육용 코딩드론"
    });
    expect(findCode(result.weaknesses, "CATEGORY_MISMATCH")).toBe(true);
  });

  it("generateSuggestions는 누락 키워드를 반영한 후보를 생성한다", async () => {
    const suggestions = await analyzer.generateSuggestions({
      productName: "허밍버드PRO",
      brand: "메이크웨어",
      targetKeywords: ["코딩드론", "파이썬"]
    });
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]?.productName).toContain("메이크웨어");
  });

  it("productName이 비어 있으면 ValidationError를 던진다", async () => {
    await expect(analyzer.analyze({ productName: "" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("LLM 없이도 전체 분석이 정상 동작한다", async () => {
    const result = await analyzer.analyze({ productName: "허밍버드PRO 교육용 코딩드론" });
    expect(result.metadata.llmUsed).toBe(false);
    expect(result.metadata.engineVersion).toBeTruthy();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });
});
