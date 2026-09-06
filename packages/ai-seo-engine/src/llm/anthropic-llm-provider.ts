import type { ContentQualityInput } from "../content/content-types.js";
import type { SemanticAnalysisInput } from "../semantic/semantic-types.js";
import type { LlmContentAnalysis, LlmProvider, LlmSemanticAnalysis } from "./llm-provider.interface.js";

export interface AnthropicLlmProviderOptions {
  /** 호출자가 관리하는 API 키를 그대로 전달한다 - 엔진 내부에 키를 저장/캐시하지 않는다. */
  apiKey: string;
  model?: string;
  baseUrl?: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

/**
 * Anthropic Claude를 사용하는 LlmProvider 구현체. SemanticAnalyzer/ContentQualityAnalyzer가
 * 이 결과를 규칙 기반 분석 결과에 "보강"만 하고 최종 점수는 그대로 대체하지 않으므로
 * (원칙: LLM 응답을 검증 없이 최종 점수로 사용하지 않음), 여기서는 LLM 응답 JSON 파싱이
 * 실패해도 예외를 던지지 않고 빈 결과를 반환해 규칙 기반 분석이 항상 정상 동작하도록 한다.
 */
export class AnthropicLlmProvider implements LlmProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly maxOutputTokens: number;
  private readonly timeoutMs: number;

  constructor(options: AnthropicLlmProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? "claude-sonnet-5";
    this.baseUrl = (options.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "");
    this.maxOutputTokens = options.maxOutputTokens ?? 1024;
    this.timeoutMs = options.timeoutMs ?? 15000;
  }

  async analyzeSemantic(input: SemanticAnalysisInput): Promise<LlmSemanticAnalysis> {
    const prompt = buildSemanticPrompt(input);

    try {
      const text = await this.callClaude(prompt);
      const parsed = extractJsonObject(text);

      return {
        interpretedMeaning: typeof parsed.interpretedMeaning === "string" ? parsed.interpretedMeaning : "",
        perceivedEntities: isRecord(parsed.perceivedEntities) ? parsed.perceivedEntities : {},
        additionalFindings: Array.isArray(parsed.additionalFindings) ? parsed.additionalFindings : [],
        additionalRecommendations: Array.isArray(parsed.additionalRecommendations) ? parsed.additionalRecommendations : [],
        confidenceHint: typeof parsed.confidenceHint === "number" ? parsed.confidenceHint : undefined,
        raw: text
      };
    } catch {
      return { interpretedMeaning: "", perceivedEntities: {}, additionalFindings: [], additionalRecommendations: [] };
    }
  }

  async analyzeContent(input: ContentQualityInput): Promise<LlmContentAnalysis> {
    const prompt = buildContentPrompt(input);

    try {
      const text = await this.callClaude(prompt);
      const parsed = extractJsonObject(text);

      return {
        summary: typeof parsed.summary === "string" ? parsed.summary : "",
        additionalFindings: Array.isArray(parsed.additionalFindings) ? parsed.additionalFindings : [],
        additionalRecommendations: Array.isArray(parsed.additionalRecommendations) ? parsed.additionalRecommendations : [],
        confidenceHint: typeof parsed.confidenceHint === "number" ? parsed.confidenceHint : undefined,
        raw: text
      };
    } catch {
      return { summary: "", additionalFindings: [], additionalRecommendations: [] };
    }
  }

  private async callClaude(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: this.maxOutputTokens,
          messages: [{ role: "user", content: prompt }]
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Anthropic API 오류 (HTTP ${response.status}): ${text.slice(0, 200)}`);
      }

      const payload = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
      const textBlock = payload.content?.find((block) => block.type === "text");

      if (!textBlock?.text) {
        throw new Error("Anthropic API 응답에서 텍스트를 찾을 수 없습니다.");
      }

      return textBlock.text;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function buildSemanticPrompt(input: SemanticAnalysisInput): string {
  return [
    "너는 이커머스 상품명 SEO 분석가다. 아래 상품명을 분석해서 JSON으로만 답하라.",
    "다른 설명 텍스트 없이 다음 스키마의 JSON 객체만 출력하라:",
    `{"interpretedMeaning": string, "perceivedEntities": {"brand"?: string, "productType"?: string}, "additionalFindings": [{"code": string, "title": string, "description": string}], "additionalRecommendations": [{"code": string, "priority": "HIGH"|"MEDIUM"|"LOW", "title": string, "description": string}], "confidenceHint": number}`,
    "",
    `상품명: ${input.productName}`,
    input.brand ? `브랜드: ${input.brand}` : "",
    input.category ? `카테고리: ${input.category}` : "",
    input.targetKeywords?.length ? `목표 키워드: ${input.targetKeywords.join(", ")}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function buildContentPrompt(input: ContentQualityInput): string {
  const text = (input.plainText ?? input.html ?? "").slice(0, 4000);
  return [
    "너는 이커머스 상세페이지 품질 분석가다. 아래 상세페이지 본문을 분석해서 JSON으로만 답하라.",
    "다른 설명 텍스트 없이 다음 스키마의 JSON 객체만 출력하라:",
    `{"summary": string, "additionalFindings": [{"code": string, "title": string, "description": string}], "additionalRecommendations": [{"code": string, "priority": "HIGH"|"MEDIUM"|"LOW", "title": string, "description": string}], "confidenceHint": number}`,
    "",
    input.productName ? `상품명: ${input.productName}` : "",
    input.category ? `카테고리: ${input.category}` : "",
    `본문(일부): ${text}`
  ]
    .filter(Boolean)
    .join("\n");
}

function extractJsonObject(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("응답에서 JSON 객체를 찾을 수 없습니다.");
  }
  const parsed = JSON.parse(match[0]);
  if (!isRecord(parsed)) {
    throw new Error("응답 JSON이 객체 형태가 아닙니다.");
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
