import type { ContentSectionKey } from "./content-types.js";

export interface ContentRulesConfig {
  /** 이보다 짧으면 정보량 부족으로 판단한다. */
  minTextLength: number;
  /** 이 정도 길이를 "충분한 정보량"의 기준으로 삼는다. */
  idealTextLength: number;
  /** 키워드 밀도가 이 값을 넘으면 "과다 반복"으로 판단한다 (예: 0.05 = 전체 단어의 5%). */
  maxKeywordDensity: number;
  /** 섹션(소개/특징/사양 등)이 존재하는지 감지할 때 쓰는 키워드 목록. 외부에서 교체/확장 가능. */
  sectionKeywords: Record<ContentSectionKey, string[]>;
}

export const DEFAULT_CONTENT_RULES: ContentRulesConfig = {
  minTextLength: 200,
  idealTextLength: 800,
  maxKeywordDensity: 0.06,
  sectionKeywords: {
    introduction: ["제품 소개", "상품 소개", "제품소개", "개요", "브랜드 소개"],
    features: ["주요 특징", "특징", "제품 특징", "이런 점이 좋아요"],
    specifications: ["제품 사양", "사양", "스펙", "규격", "제원"],
    usageGuide: ["사용 방법", "사용법", "이용 방법", "사용방법"],
    packageContents: ["구성품", "패키지 구성", "박스 구성", "구성 안내"],
    precautions: ["주의사항", "주의 사항", "유의사항", "사용시 주의"],
    faq: ["자주 묻는 질문", "FAQ", "Q&A", "문의사항"],
    targetUsers: ["이런 분께", "이런 분들께", "추천 대상", "이런 분들에게"],
    useCases: ["활용 예시", "활용법", "이럴 때 사용", "사용 예시"]
  }
};

export function mergeContentRules(overrides?: Partial<ContentRulesConfig>): ContentRulesConfig {
  return {
    ...DEFAULT_CONTENT_RULES,
    ...overrides,
    sectionKeywords: { ...DEFAULT_CONTENT_RULES.sectionKeywords, ...(overrides?.sectionKeywords ?? {}) }
  };
}
