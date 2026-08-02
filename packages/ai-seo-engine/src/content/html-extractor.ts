import * as cheerio from "cheerio";

export interface ExtractedContent {
  plainText: string;
  headingTexts: string[];
  imageCount: number;
  imagesWithAlt: number;
}

/**
 * 스마트스토어 상세페이지 HTML에서 script/style/noscript/iframe/hidden 요소, 추적 코드 등을
 * 제거하고 실제 사용자에게 보이는 텍스트만 추출한다.
 */
export function extractContentFromHtml(html: string): ExtractedContent {
  const $ = cheerio.load(html);

  $("script, style, noscript, iframe, link, meta").remove();
  $("[hidden]").remove();
  $("[style*='display:none'], [style*='display: none']").remove();
  $("[style*='visibility:hidden'], [style*='visibility: hidden']").remove();

  const headingTexts = $("h1, h2, h3, h4, strong, b")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((text) => text.length > 0 && text.length < 80);

  let imageCount = 0;
  let imagesWithAlt = 0;
  $("img").each((_, el) => {
    imageCount += 1;
    const alt = $(el).attr("alt");
    if (alt && alt.trim().length > 0) {
      imagesWithAlt += 1;
    }
  });

  const rawText = $("body").length > 0 ? $("body").text() : $.root().text();
  const plainText = normalizeWhitespace(decodeCommonEntities(rawText));

  return { plainText, headingTexts, imageCount, imagesWithAlt };
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function decodeCommonEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
