import type { AnalysisFinding, Recommendation } from "../shared/types.js";
import type { ProductNameSuggestion, SemanticAnalysisInput, SemanticEntities } from "../semantic/semantic-types.js";
import type { ContentQualityInput } from "../content/content-types.js";

/**
 * LLM 기반 분석 결과. 규칙 기반 결과(rule-based)와는 별개로 취급하며,
 * 최종 점수에 그대로 반영하지 않고 findings/recommendations 보강 및 confidenceHint로만 사용한다.
 * (원칙: LLM 응답을 검증 없이 최종 점수로 사용하지 않는다.)
 */
export interface LlmSemanticAnalysis {
  interpretedMeaning: string;
  perceivedEntities: Partial<SemanticEntities>;
  additionalFindings: AnalysisFinding[];
  additionalRecommendations: Recommendation[];
  /** LLM이 스스로 평가한 신뢰도 힌트 (0~1). 최종 confidence 계산의 참고 요소일 뿐, 그대로 채택하지 않는다. */
  confidenceHint?: number;
  raw?: unknown;
}

export interface LlmContentAnalysis {
  summary: string;
  additionalFindings: AnalysisFinding[];
  additionalRecommendations: Recommendation[];
  confidenceHint?: number;
  raw?: unknown;
}

/**
 * 특정 AI 업체에 종속되지 않는 LLM 추상화.
 * 엔진 내부에 API 키를 저장하지 않는다 — 실제 어댑터(Anthropic/OpenAI 등)는 이 인터페이스를
 * 구현하는 별도 패키지/모듈에서 외부로부터 클라이언트를 주입받아 구성한다.
 */
export interface LlmProvider {
  analyzeSemantic(input: SemanticAnalysisInput): Promise<LlmSemanticAnalysis>;
  analyzeContent(input: ContentQualityInput): Promise<LlmContentAnalysis>;
  generateProductNameSuggestions?(input: SemanticAnalysisInput): Promise<ProductNameSuggestion[]>;
}
