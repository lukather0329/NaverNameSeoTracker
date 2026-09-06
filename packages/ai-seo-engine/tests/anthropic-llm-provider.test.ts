import { afterEach, describe, expect, it, vi } from "vitest";
import { AnthropicLlmProvider } from "../src/llm/anthropic-llm-provider.js";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function mockClaudeResponse(jsonText: string) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ content: [{ type: "text", text: jsonText }] })
  }) as unknown as typeof fetch;
}

describe("AnthropicLlmProvider", () => {
  it("analyzeSemantic은 정상 JSON 응답을 파싱한다", async () => {
    mockClaudeResponse(
      JSON.stringify({
        interpretedMeaning: "교육용 코딩드론으로 보입니다.",
        perceivedEntities: { brand: "메이크웨어", productType: "코딩드론" },
        additionalFindings: [{ code: "LLM_NOTE", title: "참고", description: "설명" }],
        additionalRecommendations: [],
        confidenceHint: 0.7
      })
    );

    const provider = new AnthropicLlmProvider({ apiKey: "test-key" });
    const result = await provider.analyzeSemantic({ productName: "허밍버드PRO", brand: "메이크웨어" });

    expect(result.interpretedMeaning).toContain("코딩드론");
    expect(result.perceivedEntities.brand).toBe("메이크웨어");
    expect(result.additionalFindings).toHaveLength(1);
    expect(result.confidenceHint).toBe(0.7);
  });

  it("analyzeContent은 정상 JSON 응답을 파싱한다", async () => {
    mockClaudeResponse(JSON.stringify({ summary: "설명이 부족합니다.", additionalFindings: [], additionalRecommendations: [] }));

    const provider = new AnthropicLlmProvider({ apiKey: "test-key" });
    const result = await provider.analyzeContent({ plainText: "짧은 설명" });

    expect(result.summary).toBe("설명이 부족합니다.");
  });

  it("JSON이 아닌 응답이 와도 예외를 던지지 않고 빈 결과를 반환한다", async () => {
    mockClaudeResponse("죄송하지만 분석할 수 없습니다.");

    const provider = new AnthropicLlmProvider({ apiKey: "test-key" });
    const result = await provider.analyzeSemantic({ productName: "테스트" });

    expect(result.interpretedMeaning).toBe("");
    expect(result.additionalFindings).toEqual([]);
  });

  it("API 호출이 실패해도 예외를 던지지 않고 빈 결과를 반환한다", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "unauthorized" }) as unknown as typeof fetch;

    const provider = new AnthropicLlmProvider({ apiKey: "bad-key" });
    const result = await provider.analyzeContent({ plainText: "본문" });

    expect(result.summary).toBe("");
  });

  it("요청 본문에 model/apiKey가 올바르게 전달된다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: "text", text: "{}" }] })
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new AnthropicLlmProvider({ apiKey: "my-key", model: "claude-haiku-4-5-20251001" });
    await provider.analyzeSemantic({ productName: "테스트 상품" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v1/messages");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("my-key");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("claude-haiku-4-5-20251001");
  });
});
