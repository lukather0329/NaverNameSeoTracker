import { computeConfidence } from "../scoring/confidence-score.js";
import { scoreToGrade } from "../scoring/score-normalizer.js";
import { computeWeightedScore, DEFAULT_CONTENT_WEIGHTS } from "../scoring/weighted-score.js";
import { ENGINE_VERSION } from "../shared/constants.js";
import type { AnalysisFinding, Recommendation } from "../shared/types.js";
import { clamp, countOccurrences, hashInput, nowIso, round } from "../shared/utils.js";
import { ValidationError } from "../shared/errors.js";
import type { LlmProvider } from "../llm/llm-provider.interface.js";
import { DEFAULT_CONTENT_RULES, mergeContentRules, type ContentRulesConfig } from "./content-rules.js";
import { extractContentFromHtml } from "./html-extractor.js";
import type {
  ContentQualityDetails,
  ContentQualityInput,
  ContentQualityResult,
  ContentSectionKey
} from "./content-types.js";

export interface ContentQualityAnalyzerOptions {
  rules?: Partial<ContentRulesConfig>;
  weights?: Record<string, number>;
  llmProvider?: LlmProvider;
}

const RULESET_VERSION = "content-rules@1";
const SECTION_KEYS: ContentSectionKey[] = [
  "introduction",
  "features",
  "specifications",
  "usageGuide",
  "packageContents",
  "precautions",
  "faq",
  "targetUsers",
  "useCases"
];

/**
 * 스마트스토어 상품 상세 설명(HTML 또는 plainText)을 분석한다.
 * 텍스트가 많다는 이유만으로 높은 점수를 주지 않고, 정보량/구조/명확성/중복 여부/
 * 상품명과의 일관성을 함께 평가한다.
 */
export class ContentQualityAnalyzer {
  private readonly rules: ContentRulesConfig;
  private readonly weights: Record<string, number>;
  private readonly llmProvider?: LlmProvider;

  constructor(options: ContentQualityAnalyzerOptions = {}) {
    this.rules = mergeContentRules(options.rules);
    this.weights = options.weights ?? DEFAULT_CONTENT_WEIGHTS;
    this.llmProvider = options.llmProvider;
  }

  async analyze(input: ContentQualityInput): Promise<ContentQualityResult> {
    if (!input.html && !input.plainText) {
      throw new ValidationError("html 또는 plainText 중 하나는 반드시 있어야 합니다.");
    }

    const strengths: AnalysisFinding[] = [];
    const weaknesses: AnalysisFinding[] = [];
    const recommendations: Recommendation[] = [];

    const extracted = input.html
      ? extractContentFromHtml(input.html)
      : { plainText: (input.plainText ?? "").trim(), headingTexts: [], imageCount: 0, imagesWithAlt: 0 };

    const plainText = extracted.plainText || (input.plainText ?? "").trim();
    const textLength = plainText.length;
    const wordCount = plainText.length === 0 ? 0 : plainText.split(/\s+/).filter(Boolean).length;
    const headingCount = extracted.headingTexts.length;

    // 이미지 중심 페이지 여부
    const isImageOnlyPage = extracted.imageCount > 0 && textLength < this.rules.minTextLength;
    if (isImageOnlyPage) {
      weaknesses.push({
        code: "IMAGE_ONLY_PAGE",
        title: "이미지 위주 상세페이지로 보입니다",
        description: `텍스트 ${textLength}자 / 이미지 ${extracted.imageCount}개. 검색 시스템은 이미지 내부 텍스트를 읽지 못합니다.`
      });
      recommendations.push({
        code: "ADD_TEXT_CONTENT",
        priority: "HIGH",
        title: "이미지에 담긴 정보를 텍스트로도 제공하세요",
        description: "이미지 안의 문구를 본문 텍스트로 반복하면 검색 노출과 접근성이 개선됩니다."
      });
    }

    // 전체 텍스트 길이 / 실제 설명 텍스트 비율
    let completenessBase = 0;
    if (textLength < this.rules.minTextLength) {
      weaknesses.push({
        code: "CONTENT_TOO_SHORT",
        title: "본문 텍스트가 부족합니다",
        description: `현재 ${textLength}자, 권장 최소 ${this.rules.minTextLength}자.`
      });
      recommendations.push({
        code: "EXPAND_CONTENT",
        priority: "HIGH",
        title: "제품 설명을 보강하세요",
        description: "특징, 사양, 사용법 등 구체적인 정보를 추가하세요."
      });
      completenessBase = round((textLength / this.rules.minTextLength) * 40);
    } else {
      completenessBase = round(clamp(40 + ((textLength - this.rules.minTextLength) / this.rules.idealTextLength) * 60, 40, 100));
      strengths.push({ code: "CONTENT_LENGTH_OK", title: "본문 텍스트 분량이 충분합니다", description: `${textLength}자` });
    }

    // 제목과 소제목 구조
    const hasHeadings = headingCount > 0;
    if (!hasHeadings) {
      weaknesses.push({
        code: "NO_HEADING_STRUCTURE",
        title: "소제목 구조가 없습니다",
        description: "전체가 하나의 덩어리 텍스트/이미지로만 구성되어 있습니다."
      });
      recommendations.push({
        code: "ADD_HEADINGS",
        priority: "MEDIUM",
        title: "소제목으로 섹션을 구분하세요",
        description: "제품 소개, 특징, 사양처럼 명확한 구획을 나누면 가독성이 높아집니다."
      });
    } else {
      strengths.push({ code: "HAS_HEADING_STRUCTURE", title: "소제목 구조가 있습니다", description: `${headingCount}개` });
    }

    // 섹션 존재 여부 (제품 소개/특징/사양/사용법/구성품/주의사항/FAQ/대상/활용 사례)
    const searchableText = [plainText, ...extracted.headingTexts].join(" ");
    const sections = Object.fromEntries(
      SECTION_KEYS.map((key) => [key, this.rules.sectionKeywords[key].some((term) => searchableText.includes(term))])
    ) as Record<ContentSectionKey, boolean>;

    const missingSections = SECTION_KEYS.filter((key) => !sections[key]);
    if (missingSections.length > 0) {
      weaknesses.push({
        code: "MISSING_SECTIONS",
        title: "일부 필수 섹션이 없습니다",
        description: missingSections.join(", "),
        evidence: missingSections
      });
      recommendations.push({
        code: "ADD_MISSING_SECTIONS",
        priority: missingSections.length >= SECTION_KEYS.length / 2 ? "HIGH" : "LOW",
        title: "누락된 섹션을 추가하세요",
        description: `${missingSections.join(", ")} 섹션을 추가하면 사용자 질문에 더 잘 답할 수 있습니다.`
      });
    }
    const presentSectionCount = SECTION_KEYS.length - missingSections.length;
    const structureScore = round(
      clamp((hasHeadings ? 30 : 0) + (presentSectionCount / SECTION_KEYS.length) * 70, 0, 100)
    );

    // 키워드 과다 반복 / 의미 없는 반복 문장
    const targetKeywords = input.targetKeywords ?? [];
    const repeatedKeywords = targetKeywords
      .map((keyword) => {
        const count = countOccurrences(plainText, keyword);
        const density = wordCount > 0 ? count / wordCount : 0;
        return { keyword, count, density: round(density, 4) };
      })
      .filter((entry) => entry.count > 0);

    const overDensityKeywords = repeatedKeywords.filter((entry) => entry.density > this.rules.maxKeywordDensity);
    if (overDensityKeywords.length > 0) {
      weaknesses.push({
        code: "KEYWORD_STUFFING",
        title: "일부 키워드가 과다하게 반복됩니다",
        description: overDensityKeywords.map((entry) => `${entry.keyword} (${entry.count}회)`).join(", ")
      });
      recommendations.push({
        code: "REDUCE_KEYWORD_DENSITY",
        priority: "MEDIUM",
        title: "키워드 반복을 줄이세요",
        description: "동일 키워드를 과도하게 반복하면 스팸으로 판단될 수 있습니다."
      });
    }
    const matchedKeywordCount = targetKeywords.filter((keyword) => countOccurrences(plainText, keyword) > 0).length;
    const keywordCoverageScore =
      targetKeywords.length > 0 ? round((matchedKeywordCount / targetKeywords.length) * 100) : 50;

    const repeatedSentences = findRepeatedSentences(plainText);
    if (repeatedSentences.length > 0) {
      weaknesses.push({
        code: "REPEATED_SENTENCES",
        title: "의미 없이 반복되는 문장이 있습니다",
        description: repeatedSentences.slice(0, 3).join(" / ")
      });
    }

    // 이미지 대체 텍스트 (alt)
    const imageTextBalanceScore =
      extracted.imageCount === 0
        ? 100
        : round(clamp((extracted.imagesWithAlt / extracted.imageCount) * 100, 0, 100));
    if (extracted.imageCount > 0 && extracted.imagesWithAlt < extracted.imageCount) {
      weaknesses.push({
        code: "MISSING_IMAGE_ALT",
        title: "대체 텍스트(alt)가 없는 이미지가 있습니다",
        description: `${extracted.imageCount - extracted.imagesWithAlt}개 / 전체 ${extracted.imageCount}개`
      });
    }

    // 카테고리 핵심 용어 포함 여부
    if (input.category && !searchableText.includes(input.category)) {
      weaknesses.push({
        code: "CATEGORY_TERM_MISSING",
        title: "카테고리 핵심 용어가 본문에 없습니다",
        description: `"${input.category}"가 본문에서 발견되지 않았습니다.`
      });
    }

    // 상품명과 본문 내용 일치 여부
    const titleContentConsistencyScore = input.productName
      ? computeTitleConsistencyScore(input.productName, searchableText)
      : 50;
    if (input.productName && titleContentConsistencyScore < 50) {
      weaknesses.push({
        code: "TITLE_CONTENT_MISMATCH",
        title: "상품명과 본문 내용이 잘 맞지 않습니다",
        description: "상품명에 등장하는 핵심 단어가 본문에서 충분히 재확인되지 않습니다."
      });
      recommendations.push({
        code: "ALIGN_TITLE_AND_CONTENT",
        priority: "MEDIUM",
        title: "상품명의 핵심 단어를 본문에서도 반복하세요",
        description: "상품명과 본문이 일치할수록 검색 시스템이 관련성을 판단하기 쉽습니다."
      });
    }

    const readabilityScore = round(
      clamp(
        100 -
          (repeatedSentences.length > 0 ? 20 : 0) -
          (overDensityKeywords.length > 0 ? 15 : 0) -
          (!hasHeadings ? 15 : 0),
        0,
        100
      )
    );

    const completenessScore = round(clamp(completenessBase * 0.6 + structureScore * 0.4, 0, 100));

    const componentScores: Record<string, number> = {
      completeness: completenessScore,
      structure: structureScore,
      readability: readabilityScore,
      keywordCoverage: keywordCoverageScore,
      titleContentConsistency: titleContentConsistencyScore,
      imageTextBalance: imageTextBalanceScore
    };

    let llmUsed = false;
    if (this.llmProvider) {
      try {
        const llmResult = await this.llmProvider.analyzeContent(input);
        llmUsed = true;
        weaknesses.push(...llmResult.additionalFindings.filter((f) => !weaknesses.some((w) => w.code === f.code)));
        recommendations.push(...llmResult.additionalRecommendations);
      } catch {
        llmUsed = false;
      }
    }

    const score = computeWeightedScore(componentScores, this.weights);

    const confidence = computeConfidence({
      inputCompleteness: input.html ? 1 : 0.7,
      ruleApplicability: 1,
      llmRuleAgreement: llmUsed ? 0.5 : undefined
    });

    const details: ContentQualityDetails = {
      textLength,
      wordCount,
      headingCount,
      imageCount: extracted.imageCount,
      imagesWithAlt: extracted.imagesWithAlt,
      sections,
      readabilityScore,
      structureScore,
      completenessScore,
      keywordCoverageScore,
      titleContentConsistencyScore,
      imageTextBalanceScore,
      repeatedKeywords,
      missingSections
    };

    return {
      score,
      grade: scoreToGrade(score),
      confidence,
      summary: buildSummary(score, weaknesses),
      strengths,
      weaknesses,
      recommendations,
      details,
      metadata: {
        engineVersion: ENGINE_VERSION,
        analyzedAt: nowIso(),
        inputHash: hashInput(input),
        rulesetVersion: RULESET_VERSION,
        llmUsed
      }
    };
  }
}

function findRepeatedSentences(text: string): string[] {
  const sentences = text
    .split(/[.!?。\n]/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 8);

  const counts = new Map<string, number>();
  for (const sentence of sentences) {
    counts.set(sentence, (counts.get(sentence) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count >= 2).map(([sentence]) => sentence);
}

function computeTitleConsistencyScore(productName: string, contentText: string): number {
  const titleTokens = productName.split(/[\s/_\-|,·]+/).map((token) => token.trim()).filter((token) => token.length >= 2);
  if (titleTokens.length === 0) {
    return 50;
  }
  const matched = titleTokens.filter((token) => contentText.includes(token));
  return round((matched.length / titleTokens.length) * 100);
}

function buildSummary(score: number, weaknesses: AnalysisFinding[]): string {
  if (weaknesses.length === 0) {
    return `상세페이지 품질 점수 ${score}점. 규칙 기반 검사에서 특별한 문제가 발견되지 않았습니다.`;
  }
  return `상세페이지 품질 점수 ${score}점. 주요 개선 필요 항목 ${weaknesses.length}건: ${weaknesses
    .slice(0, 3)
    .map((w) => w.title)
    .join(", ")}`;
}
