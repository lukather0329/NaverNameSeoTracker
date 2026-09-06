import { afterEach, describe, expect, it, vi } from "vitest";
import { MonteCarloHttpAdapter } from "../src/prediction/monte-carlo-http-adapter.js";
import type { NaverSeoSimulationContext } from "../src/prediction/monte-carlo-http-adapter.js";
import type { SeoActionScenario } from "../src/prediction/predictor-types.js";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function buildContext(overrides: Partial<NaverSeoSimulationContext> = {}): NaverSeoSimulationContext {
  return {
    productId: "product-1",
    keyword: "코딩드론",
    baseline: { rankHistory: [20, 19, 21, 18], price: 10000 },
    titleScoreBefore: 60,
    titleScoreAfter: 80,
    ...overrides
  };
}

describe("MonteCarloHttpAdapter", () => {
  it("context 없이 다른 액션 타입은 실제 호출 없이 제공된 가정으로 추정한다", async () => {
    const adapter = new MonteCarloHttpAdapter({ baseUrl: "http://127.0.0.1:8765" });
    const scenario: SeoActionScenario = {
      action: "ADD_FAQ",
      estimatedImpactRange: { min: -2, max: 6 },
      probabilityDistribution: { mean: 2, standardDeviation: 3 }
    };

    const result = await adapter.predict([scenario]);

    expect(result.simulations).toBe(0);
    expect(result.scenarios).toHaveLength(1);
    expect(result.scenarios[0]?.action).toBe("ADD_FAQ");
    expect(result.scenarios[0]?.probabilityOfImprovement).toBeGreaterThan(0.5);
    expect(result.assumptions[0]).toContain("실제 시뮬레이션이 아니라");
  });

  it("CHANGE_PRODUCT_NAME인데 context가 없으면 경고를 남기고 추정치로 대체한다", async () => {
    const adapter = new MonteCarloHttpAdapter({ baseUrl: "http://127.0.0.1:8765" });
    const scenario: SeoActionScenario = {
      action: "CHANGE_PRODUCT_NAME",
      estimatedImpactRange: { min: -5, max: 10 }
    };

    const result = await adapter.predict([scenario]);

    expect(result.warnings.some((w) => w.includes("context"))).toBe(true);
    expect(result.scenarios[0]?.action).toBe("CHANGE_PRODUCT_NAME");
  });

  it("CHANGE_PRODUCT_NAME + context가 있으면 실제 엔진 응답을 사용한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        iterations: 20000,
        results: {
          probabilityPositiveCtrLift: 0.72,
          expectedCtrLift: { median: 0.05, p10: -0.01, p90: 0.12 }
        }
      })
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const adapter = new MonteCarloHttpAdapter({ baseUrl: "http://127.0.0.1:8765" });
    const scenario: SeoActionScenario = {
      action: "CHANGE_PRODUCT_NAME",
      estimatedImpactRange: { min: 0, max: 0.1 },
      probabilityDistribution: { mean: 0.05, standardDeviation: 0.03 }
    };

    const result = await adapter.predict([scenario], buildContext());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/naver-seo/simulate");
    expect(result.simulations).toBe(20000);
    expect(result.scenarios[0]?.probabilityOfImprovement).toBe(0.72);
    expect(result.scenarios[0]?.riskLevel).toBe("LOW");
    expect(result.assumptions[0]).toContain("실제 몬테카를로 시뮬레이션");
  });

  it("실제 엔진 호출이 실패하면 경고를 남기고 추정치로 안전하게 대체한다", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "internal error" }) as unknown as typeof fetch;

    const adapter = new MonteCarloHttpAdapter({ baseUrl: "http://127.0.0.1:8765" });
    const scenario: SeoActionScenario = {
      action: "CHANGE_PRODUCT_NAME",
      estimatedImpactRange: { min: -1, max: 5 }
    };

    const result = await adapter.predict([scenario], buildContext());

    expect(result.warnings.some((w) => w.includes("실패"))).toBe(true);
    expect(result.scenarios).toHaveLength(1);
    expect(result.simulations).toBe(0);
  });

  it("여러 시나리오를 섞으면 각각 올바르게 분류되어 처리된다", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        iterations: 15000,
        results: { probabilityPositiveCtrLift: 0.5, expectedCtrLift: { median: 0, p10: -0.05, p90: 0.05 } }
      })
    }) as unknown as typeof fetch;

    const adapter = new MonteCarloHttpAdapter({ baseUrl: "http://127.0.0.1:8765" });
    const scenarios: SeoActionScenario[] = [
      { action: "CHANGE_PRODUCT_NAME", estimatedImpactRange: { min: -1, max: 1 } },
      { action: "IMPROVE_CONTENT", estimatedImpactRange: { min: 0, max: 3 } }
    ];

    const result = await adapter.predict(scenarios, buildContext());

    expect(result.scenarios).toHaveLength(2);
    expect(result.scenarios[0]?.action).toBe("CHANGE_PRODUCT_NAME");
    expect(result.scenarios[1]?.action).toBe("IMPROVE_CONTENT");
    expect(result.simulations).toBe(15000);
  });
});
