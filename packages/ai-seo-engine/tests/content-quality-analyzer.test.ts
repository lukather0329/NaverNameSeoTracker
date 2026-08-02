import { describe, expect, it } from "vitest";
import { ContentQualityAnalyzer } from "../src/content/content-quality-analyzer.js";
import { ValidationError } from "../src/shared/errors.js";

function findCode(codes: Array<{ code: string }>, code: string) {
  return codes.some((item) => item.code === code);
}

describe("ContentQualityAnalyzer", () => {
  const analyzer = new ContentQualityAnalyzer();

  it("이미지밖에 없는 페이지는 IMAGE_ONLY_PAGE를 감지한다", async () => {
    const html = `<div><img src="a.jpg" alt="상품 이미지 1"/><img src="b.jpg"/></div>`;
    const result = await analyzer.analyze({ html });
    expect(findCode(result.weaknesses, "IMAGE_ONLY_PAGE")).toBe(true);
  });

  it("텍스트만 있는 페이지(plainText)도 분석 가능하다", async () => {
    const plainText = "제품 소개입니다. ".repeat(30);
    const result = await analyzer.analyze({ plainText });
    expect(result.details.textLength).toBeGreaterThan(0);
    expect(result.details.imageCount).toBe(0);
  });

  it("FAQ 섹션이 포함되면 sections.faq가 true이다", async () => {
    const html = `<div><h2>제품 소개</h2><p>${"내용 ".repeat(60)}</p><h2>자주 묻는 질문</h2><p>Q: 배송은 얼마나 걸리나요?</p></div>`;
    const result = await analyzer.analyze({ html });
    expect(result.details.sections.faq).toBe(true);
  });

  it("사양 섹션이 포함되면 sections.specifications가 true이다", async () => {
    const html = `<div><h2>제품 사양</h2><p>${"규격 정보 ".repeat(50)}</p></div>`;
    const result = await analyzer.analyze({ html });
    expect(result.details.sections.specifications).toBe(true);
  });

  it("소제목 구조가 있으면 HAS_HEADING_STRUCTURE 강점을 갖는다", async () => {
    const html = `<div><h2>제품 소개</h2><p>${"내용 ".repeat(60)}</p></div>`;
    const result = await analyzer.analyze({ html });
    expect(findCode(result.strengths, "HAS_HEADING_STRUCTURE")).toBe(true);
    expect(result.details.headingCount).toBeGreaterThan(0);
  });

  it("소제목이 전혀 없으면 NO_HEADING_STRUCTURE 약점을 갖는다", async () => {
    const result = await analyzer.analyze({ plainText: "그냥 긴 문단입니다. ".repeat(30) });
    expect(findCode(result.weaknesses, "NO_HEADING_STRUCTURE")).toBe(true);
  });

  it("동일 문장이 반복되면 REPEATED_SENTENCES를 감지한다", async () => {
    const plainText = ("이 제품은 정말 좋습니다. ".repeat(5) + " " + "추가 설명이 필요합니다. ".repeat(20)).trim();
    const result = await analyzer.analyze({ plainText });
    expect(findCode(result.weaknesses, "REPEATED_SENTENCES")).toBe(true);
  });

  it("목표 키워드가 과다 반복되면 KEYWORD_STUFFING을 감지한다", async () => {
    const plainText = ("코딩드론 ".repeat(80) + "다른 설명 단어들 ".repeat(20)).trim();
    const result = await analyzer.analyze({ plainText, targetKeywords: ["코딩드론"] });
    expect(findCode(result.weaknesses, "KEYWORD_STUFFING")).toBe(true);
  });

  it("이미지 alt가 없는 이미지가 있으면 MISSING_IMAGE_ALT를 감지한다", async () => {
    const html = `<div><h2>제품 소개</h2><p>${"내용 ".repeat(60)}</p><img src="a.jpg"/></div>`;
    const result = await analyzer.analyze({ html });
    expect(findCode(result.weaknesses, "MISSING_IMAGE_ALT")).toBe(true);
    expect(result.details.imagesWithAlt).toBe(0);
  });

  it("script/style 태그는 본문 텍스트 추출에서 제거된다", async () => {
    const html = `<div><script>alert('x')</script><style>.a{color:red}</style><p>${"실제 보이는 내용입니다 ".repeat(30)}</p></div>`;
    const result = await analyzer.analyze({ html });
    expect(result.details.textLength).toBeGreaterThan(0);
  });

  it("빈 HTML(태그만 있고 텍스트 없음)은 CONTENT_TOO_SHORT를 반환한다", async () => {
    const html = `<div><script>var a = 1;</script></div>`;
    const result = await analyzer.analyze({ html });
    expect(findCode(result.weaknesses, "CONTENT_TOO_SHORT")).toBe(true);
  });

  it("html도 plainText도 없으면 ValidationError를 던진다", async () => {
    await expect(analyzer.analyze({})).rejects.toBeInstanceOf(ValidationError);
  });

  it("상품명과 본문이 일치하면 titleContentConsistencyScore가 높다", async () => {
    const html = `<h2>제품 소개</h2><p>허밍버드PRO 코딩드론은 ${"교육용으로 좋습니다 ".repeat(30)}</p>`;
    const result = await analyzer.analyze({ html, productName: "허밍버드PRO 코딩드론" });
    expect(result.details.titleContentConsistencyScore).toBeGreaterThan(50);
  });
});
