import { computeConfidence } from "../scoring/confidence-score.js";
import { scoreToGrade } from "../scoring/score-normalizer.js";
import { computeWeightedScore, DEFAULT_SEMANTIC_WEIGHTS } from "../scoring/weighted-score.js";
import { ENGINE_VERSION } from "../shared/constants.js";
import type { AnalysisFinding, Recommendation } from "../shared/types.js";
import { clamp, hashInput, nowIso, round } from "../shared/utils.js";
import { ValidationError } from "../shared/errors.js";
import type { LlmProvider } from "../llm/llm-provider.interface.js";
import { DEFAULT_SEMANTIC_RULES, mergeSemanticRules, type SemanticRulesConfig } from "./semantic-rules.js";
import type {
  ProductNameSuggestion,
  SemanticAnalysisDetails,
  SemanticAnalysisInput,
  SemanticAnalysisResult,
  SemanticEntities,
  SuggestionOptions
} from "./semantic-types.js";

export interface SemanticAnalyzerOptions {
  rules?: Partial<SemanticRulesConfig>;
  weights?: Record<string, number>;
  llmProvider?: LlmProvider;
}

const RULESET_VERSION = "semantic-rules@1";

/**
 * 상품명을 규칙 기반으로 분석한다. LLM은 선택 사항이며, 제공되지 않아도 전체 분석이 동작한다.
 * 반환되는 점수는 네이버의 실제 검색/랭킹 알고리즘 점수가 아니라 공개적으로 관찰 가능한
 * 상품명 구조에 기반한 내부 추정치다.
 */
export class SemanticAnalyzer {
  private readonly rules: SemanticRulesConfig;
  private readonly weights: Record<string, number>;
  private readonly llmProvider?: LlmProvider;

  constructor(options: SemanticAnalyzerOptions = {}) {
    this.rules = mergeSemanticRules(options.rules);
    this.weights = options.weights ?? DEFAULT_SEMANTIC_WEIGHTS;
    this.llmProvider = options.llmProvider;
  }

  async analyze(input: SemanticAnalysisInput): Promise<SemanticAnalysisResult> {
    if (!input.productName || !input.productName.trim()) {
      throw new ValidationError("productName은 비어 있을 수 없습니다.");
    }

    const name = input.productName.trim();
    const tokens = tokenize(name);
    const targetKeywords = input.targetKeywords ?? [];
    const prohibitedKeywords = input.prohibitedKeywords ?? [];

    const strengths: AnalysisFinding[] = [];
    const weaknesses: AnalysisFinding[] = [];
    const recommendations: Recommendation[] = [];

    // 1. 상품명이 지나치게 짧은지 / 2. 지나치게 긴지
    let clarityScore = 100;
    if (name.length < this.rules.minNameLength) {
      clarityScore -= 30;
      weaknesses.push({
        code: "NAME_TOO_SHORT",
        title: "상품명이 지나치게 짧습니다",
        description: `현재 ${name.length}자입니다. 최소 ${this.rules.minNameLength}자 이상을 권장합니다.`
      });
      recommendations.push({
        code: "ADD_DESCRIPTIVE_TERMS",
        priority: "HIGH",
        title: "제품 유형과 핵심 속성을 추가하세요",
        description: "브랜드나 모델명만으로는 검색 의도를 충족하기 어렵습니다."
      });
    } else if (name.length > this.rules.maxNameLength) {
      clarityScore -= 15;
      weaknesses.push({
        code: "NAME_TOO_LONG",
        title: "상품명이 지나치게 깁니다",
        description: `현재 ${name.length}자입니다. ${this.rules.maxNameLength}자 이하를 권장합니다.`
      });
      recommendations.push({
        code: "SHORTEN_NAME",
        priority: "MEDIUM",
        title: "핵심 키워드 위주로 축약하세요",
        description: "너무 긴 상품명은 검색 결과에서 잘리거나 가독성이 떨어질 수 있습니다."
      });
    } else {
      strengths.push({
        code: "NAME_LENGTH_OK",
        title: "상품명 길이가 적절합니다",
        description: `${name.length}자로 권장 범위 내에 있습니다.`
      });
    }

    // 3. 브랜드가 포함됐는지
    const brandIncluded = Boolean(input.brand) && containsTerm(name, input.brand as string);
    if (input.brand) {
      if (brandIncluded) {
        strengths.push({ code: "BRAND_PRESENT", title: "브랜드명이 포함되어 있습니다", description: `"${input.brand}"` });
      } else {
        weaknesses.push({
          code: "BRAND_MISSING",
          title: "브랜드명이 상품명에 없습니다",
          description: `입력된 브랜드 "${input.brand}"가 상품명에서 발견되지 않았습니다.`
        });
      }
    }

    // 4. 제품 유형이 명확한지 / 12. 브랜드명만 있고 제품 설명이 없는지
    const nonBrandTokens = tokens.filter((token) => !input.brand || !containsTerm(token, input.brand));
    const categoryTerms = input.category ? tokenize(input.category) : [];
    const categoryTermMatches = categoryTerms.filter((term) => containsTerm(name, term));
    const productTypePresent = categoryTermMatches.length > 0 || nonBrandTokens.length >= 2;
    let productTypePresenceScore = productTypePresent ? 100 : 20;

    if (!productTypePresent) {
      weaknesses.push({
        code: "PRODUCT_TYPE_UNCLEAR",
        title: "제품 유형을 파악하기 어렵습니다",
        description: "브랜드/모델명 외에 제품이 무엇인지 알려주는 단어가 부족합니다."
      });
      recommendations.push({
        code: "ADD_PRODUCT_TYPE",
        priority: "HIGH",
        title: "제품 유형을 명시하세요",
        description: "예: 카테고리명, 제품 종류를 나타내는 명사를 추가하세요."
      });
    } else {
      strengths.push({ code: "PRODUCT_TYPE_CLEAR", title: "제품 유형이 비교적 명확합니다", description: "" });
    }

    if (brandIncluded && nonBrandTokens.length === 0) {
      productTypePresenceScore = 0;
      weaknesses.push({
        code: "BRAND_ONLY_NAME",
        title: "브랜드명만 있고 제품 설명이 없습니다",
        description: "브랜드/모델명 외에 제품을 설명하는 단어가 전혀 없습니다."
      });
    }

    // 5. 핵심 키워드가 포함됐는지
    const matchedKeywords = targetKeywords.filter((keyword) => containsTerm(name, keyword));
    const missingKeywords = targetKeywords.filter((keyword) => !containsTerm(name, keyword));
    const keywordBalanceScore =
      targetKeywords.length > 0 ? round((matchedKeywords.length / targetKeywords.length) * 100) : 50;

    if (targetKeywords.length > 0) {
      if (missingKeywords.length > 0) {
        weaknesses.push({
          code: "MISSING_TARGET_KEYWORDS",
          title: "목표 키워드 일부가 누락되었습니다",
          description: `누락된 키워드: ${missingKeywords.join(", ")}`,
          evidence: missingKeywords
        });
        recommendations.push({
          code: "INCLUDE_MISSING_KEYWORDS",
          priority: missingKeywords.length >= targetKeywords.length ? "HIGH" : "MEDIUM",
          title: "누락된 목표 키워드를 반영하세요",
          description: `${missingKeywords.join(", ")}를 자연스럽게 포함해보세요.`
        });
      }
      if (matchedKeywords.length > 0) {
        strengths.push({
          code: "TARGET_KEYWORDS_MATCHED",
          title: "목표 키워드가 포함되어 있습니다",
          description: matchedKeywords.join(", "),
          evidence: matchedKeywords
        });
      }
    }

    // 금지 키워드
    const prohibitedFound = prohibitedKeywords.filter((keyword) => containsTerm(name, keyword));
    if (prohibitedFound.length > 0) {
      weaknesses.push({
        code: "PROHIBITED_KEYWORDS_FOUND",
        title: "금지 키워드가 포함되어 있습니다",
        description: prohibitedFound.join(", "),
        evidence: prohibitedFound
      });
      recommendations.push({
        code: "REMOVE_PROHIBITED_KEYWORDS",
        priority: "HIGH",
        title: "금지 키워드를 제거하세요",
        description: `${prohibitedFound.join(", ")}는 정책상 사용할 수 없습니다.`
      });
    }

    // 6. 동일 단어가 반복되는지
    const duplicatedTerms = findDuplicatedTerms(tokens, this.rules.duplicateWordThreshold);
    const duplicationPenaltyScore = duplicatedTerms.length > 0 ? clamp(100 - duplicatedTerms.length * 30, 0, 100) : 100;
    if (duplicatedTerms.length > 0) {
      weaknesses.push({
        code: "DUPLICATED_TERMS",
        title: "동일 단어가 반복됩니다",
        description: duplicatedTerms.join(", "),
        evidence: duplicatedTerms
      });
      recommendations.push({
        code: "REMOVE_DUPLICATED_TERMS",
        priority: "MEDIUM",
        title: "반복되는 단어를 정리하세요",
        description: "동일한 단어를 여러 번 쓰는 대신 다른 속성을 추가하세요."
      });
    }

    // 7. 특수문자가 과도한지
    const specialCharRatio = computeSpecialCharRatio(name);
    const specialCharOk = specialCharRatio <= this.rules.maxSpecialCharRatio;
    if (!specialCharOk) {
      weaknesses.push({
        code: "EXCESSIVE_SPECIAL_CHARS",
        title: "특수문자가 과도합니다",
        description: `특수문자 비율 ${round(specialCharRatio * 100)}%`
      });
      recommendations.push({
        code: "REDUCE_SPECIAL_CHARS",
        priority: "LOW",
        title: "불필요한 특수문자를 줄이세요",
        description: "!, ★, ~ 등 과도한 기호는 검색 노출에 불리할 수 있습니다."
      });
    }

    // 8. 광고성 표현이 과도한지
    const suspiciousTerms = this.rules.promotionalTerms.filter((term) => containsTerm(name, term));
    const promotionalPenaltyScore = suspiciousTerms.length > 0 ? clamp(100 - suspiciousTerms.length * 25, 0, 100) : 100;
    if (suspiciousTerms.length > 0) {
      weaknesses.push({
        code: "PROMOTIONAL_LANGUAGE",
        title: "광고성 표현이 포함되어 있습니다",
        description: suspiciousTerms.join(", "),
        evidence: suspiciousTerms
      });
      recommendations.push({
        code: "REMOVE_PROMOTIONAL_LANGUAGE",
        priority: "MEDIUM",
        title: "광고성 표현을 제거하세요",
        description: `${suspiciousTerms.join(", ")}는 검색 노출 정책에 위배될 수 있습니다.`
      });
    }

    // 9. 카테고리와 상품명이 일치하는지
    const categoryAlignmentScore =
      categoryTerms.length > 0 ? round((categoryTermMatches.length / categoryTerms.length) * 100) : 50;
    if (categoryTerms.length > 0 && categoryTermMatches.length === 0) {
      weaknesses.push({
        code: "CATEGORY_MISMATCH",
        title: "카테고리와 상품명이 일치하지 않습니다",
        description: `카테고리 "${input.category}"를 나타내는 표현이 상품명에 없습니다.`
      });
      recommendations.push({
        code: "ALIGN_WITH_CATEGORY",
        priority: "MEDIUM",
        title: "카테고리를 반영하는 단어를 추가하세요",
        description: "검색 시스템이 카테고리 적합도를 판단하기 쉬워집니다."
      });
    }

    // 10. 주요 속성이 누락됐는지
    const attributeEntries = Object.entries(input.attributes ?? {});
    const missingAttributes = attributeEntries
      .filter(([, value]) => !containsTerm(name, String(value)))
      .map(([key]) => key);
    if (missingAttributes.length > 0) {
      weaknesses.push({
        code: "MISSING_ATTRIBUTES",
        title: "주요 속성이 상품명에 반영되지 않았습니다",
        description: missingAttributes.join(", "),
        evidence: missingAttributes
      });
    }

    // 11. 검색 의도를 이해하기 쉬운 구조인지 (종합 readability)
    const readabilityScore = round(
      clamp(
        100 -
          (specialCharOk ? 0 : 20) -
          (duplicatedTerms.length > 0 ? 15 : 0) -
          (tokens.length > 12 ? 15 : 0) -
          (tokens.length <= 1 ? 30 : 0),
        0,
        100
      )
    );

    const entities: SemanticEntities = {
      brand: input.brand,
      productType: categoryTermMatches[0] ?? input.category,
      functions: [],
      targetUsers: [],
      useCases: [],
      technologies: [],
      specifications: attributeEntries.map(([key, value]) => `${key}:${value}`),
      modifiers: suspiciousTerms
    };

    const componentScores: Record<string, number> = {
      clarity: clarityScore,
      productTypePresence: productTypePresenceScore,
      keywordCoverage: keywordBalanceScore,
      categoryAlignment: categoryAlignmentScore,
      readability: readabilityScore,
      duplicationPenalty: duplicationPenaltyScore,
      promotionalPenalty: promotionalPenaltyScore
    };

    let llmUsed = false;
    if (this.llmProvider) {
      try {
        const llmResult = await this.llmProvider.analyzeSemantic(input);
        llmUsed = true;
        weaknesses.push(...llmResult.additionalFindings.filter((f) => !weaknesses.some((w) => w.code === f.code)));
        recommendations.push(...llmResult.additionalRecommendations);
      } catch {
        // LLM 실패는 규칙 기반 분석 결과에 영향을 주지 않는다 (원칙: LLM 없이도 동작해야 함).
        llmUsed = false;
      }
    }

    const score = computeWeightedScore(componentScores, this.weights);

    const confidence = computeConfidence({
      inputCompleteness: computeInputCompleteness(input),
      ruleApplicability: 1,
      llmRuleAgreement: llmUsed ? 0.5 : undefined
    });

    const details: SemanticAnalysisDetails = {
      entities,
      matchedKeywords,
      missingKeywords,
      duplicatedTerms,
      suspiciousTerms,
      categoryAlignmentScore,
      clarityScore,
      keywordBalanceScore,
      readabilityScore
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

  /**
   * 상품명 개선 제안을 생성한다. 1차 버전은 단순 조합 규칙만 사용한다
   * (브랜드 + 누락 키워드 + 제품 유형 조합). LLM 연동 시 더 정교해질 수 있다.
   */
  async generateSuggestions(
    input: SemanticAnalysisInput,
    options: SuggestionOptions = {}
  ): Promise<ProductNameSuggestion[]> {
    const maxSuggestions = options.maxSuggestions ?? 3;
    const maxLength = options.maxLength ?? DEFAULT_SEMANTIC_RULES.maxNameLength;
    const targetKeywords = input.targetKeywords ?? [];
    const missing = targetKeywords.filter((keyword) => !containsTerm(input.productName, keyword));

    const suggestions: ProductNameSuggestion[] = [];
    const parts = [input.brand, input.productName, ...missing].filter(
      (value): value is string => Boolean(value && value.trim())
    );

    for (let take = missing.length; take >= 0 && suggestions.length < maxSuggestions; take -= 1) {
      const addedKeywords = missing.slice(0, take);
      const candidate = [input.brand, input.productName, ...addedKeywords]
        .filter((value): value is string => Boolean(value && value.trim()))
        .join(" ")
        .trim();

      if (candidate.length === 0 || candidate.length > maxLength) {
        continue;
      }
      if (suggestions.some((existing) => existing.productName === candidate)) {
        continue;
      }

      suggestions.push({
        productName: candidate,
        rationale: addedKeywords.length > 0 ? `누락 키워드 ${addedKeywords.join(", ")} 추가` : "원본 유지",
        addedKeywords
      });
    }

    return suggestions.length > 0
      ? suggestions
      : [{ productName: parts.join(" "), rationale: "조합 가능한 키워드 없음", addedKeywords: [] }];
  }
}

function tokenize(text: string): string[] {
  return text
    .split(/[\s/_\-|,·]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function containsTerm(haystack: string, term: string): boolean {
  if (!term) {
    return false;
  }
  return haystack.toLowerCase().includes(term.toLowerCase());
}

function findDuplicatedTerms(tokens: string[], threshold: number): string[] {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    if (token.length < 2) {
      continue;
    }
    const key = token.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count >= threshold).map(([term]) => term);
}

function computeSpecialCharRatio(text: string): number {
  const specialChars = text.match(/[^0-9a-zA-Z가-힣\s]/g) ?? [];
  return text.length === 0 ? 0 : specialChars.length / text.length;
}

function computeInputCompleteness(input: SemanticAnalysisInput): number {
  const fields = [input.brand, input.category, input.targetKeywords?.length ? "1" : undefined, input.attributes && Object.keys(input.attributes).length > 0 ? "1" : undefined];
  const filled = fields.filter(Boolean).length;
  return filled / fields.length;
}

function buildSummary(score: number, weaknesses: AnalysisFinding[]): string {
  if (weaknesses.length === 0) {
    return `상품명 분석 점수 ${score}점. 규칙 기반 검사에서 특별한 문제가 발견되지 않았습니다.`;
  }
  return `상품명 분석 점수 ${score}점. 주요 개선 필요 항목 ${weaknesses.length}건: ${weaknesses
    .slice(0, 3)
    .map((w) => w.title)
    .join(", ")}`;
}
