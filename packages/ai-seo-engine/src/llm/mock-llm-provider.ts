import type { ContentQualityInput } from "../content/content-types.js";
import type { SemanticAnalysisInput } from "../semantic/semantic-types.js";
import type { LlmContentAnalysis, LlmProvider, LlmSemanticAnalysis } from "./llm-provider.interface.js";

/**
 * 아무 것도 하지 않는 LLM Provider. LLM을 전혀 쓰지 않는 배포 환경에서 기본값으로 주입한다.
 * (원칙: LLM이 없어도 기본 분석이 가능해야 한다.)
 */
export class NoopLlmProvider implements LlmProvider {
  async analyzeSemantic(_input: SemanticAnalysisInput): Promise<LlmSemanticAnalysis> {
    return {
      interpretedMeaning: "",
      perceivedEntities: {},
      additionalFindings: [],
      additionalRecommendations: []
    };
  }

  async analyzeContent(_input: ContentQualityInput): Promise<LlmContentAnalysis> {
    return {
      summary: "",
      additionalFindings: [],
      additionalRecommendations: []
    };
  }
}

/**
 * 테스트 및 데모용 Mock Provider. 실제 LLM 호출 없이 입력을 단순 규칙으로 흉내내어
 * LlmProvider 인터페이스의 통합 지점(analyzer + LLM 병행 사용)을 검증하는 데 쓴다.
 * 실제 서비스에서는 Anthropic/OpenAI 등을 감싼 별도 어댑터로 교체한다.
 */
export class MockLlmProvider implements LlmProvider {
  async analyzeSemantic(input: SemanticAnalysisInput): Promise<LlmSemanticAnalysis> {
    const name = input.productName ?? "";
    return {
      interpretedMeaning: name ? `"${name}"은(는) ${input.category ?? "미분류 카테고리"} 상품으로 보입니다.` : "",
      perceivedEntities: {
        brand: input.brand,
        productType: input.category
      },
      additionalFindings: [],
      additionalRecommendations: [],
      confidenceHint: 0.5
    };
  }

  async analyzeContent(input: ContentQualityInput): Promise<LlmContentAnalysis> {
    const length = (input.plainText ?? input.html ?? "").length;
    return {
      summary: length > 0 ? "본문 텍스트를 확인했습니다." : "분석할 본문 텍스트가 없습니다.",
      additionalFindings: [],
      additionalRecommendations: [],
      confidenceHint: 0.5
    };
  }
}
