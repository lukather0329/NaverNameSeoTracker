/**
 * Semantic Analyzer 규칙 설정. 광고성 표현 목록 등을 코드에 하드코딩하지 않고
 * 이 파일(또는 외부에서 주입하는 커스텀 설정)에서 관리한다.
 */
export interface SemanticRulesConfig {
  minNameLength: number;
  maxNameLength: number;
  maxSpecialCharRatio: number;
  /** 동일 단어(2글자 이상)가 이 횟수 이상 반복되면 "중복 표현"으로 판단한다. */
  duplicateWordThreshold: number;
  /** 광고성/과장 표현 목록. 브랜드/서비스마다 다를 수 있어 외부에서 교체 가능해야 한다. */
  promotionalTerms: string[];
}

export const DEFAULT_SEMANTIC_RULES: SemanticRulesConfig = {
  minNameLength: 8,
  maxNameLength: 100,
  maxSpecialCharRatio: 0.15,
  duplicateWordThreshold: 3,
  promotionalTerms: [
    "최고",
    "최저가",
    "대박",
    "인기",
    "추천",
    "무료배송",
    "한정특가",
    "베스트",
    "1위",
    "역대급",
    "핫딜",
    "초특가",
    "품절임박",
    "강력추천"
  ]
};

export function mergeSemanticRules(overrides?: Partial<SemanticRulesConfig>): SemanticRulesConfig {
  return { ...DEFAULT_SEMANTIC_RULES, ...overrides };
}
