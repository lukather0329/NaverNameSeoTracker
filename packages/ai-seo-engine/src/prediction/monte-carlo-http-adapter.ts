import type { MonteCarloPredictor } from "./monte-carlo-predictor.interface.js";
import type { PredictionResult, ScenarioPrediction, SeoActionScenario } from "./predictor-types.js";

export interface MonteCarloHttpAdapterOptions {
  /** rw_decision_engine 기본 URL, 예: http://127.0.0.1:8765 */
  baseUrl: string;
  apiPrefix?: string;
  timeoutMs?: number;
}

/**
 * rw_decision_engine의 /naver-seo/simulate 엔드포인트가 요구하는 컨텍스트.
 * CHANGE_PRODUCT_NAME 시나리오를 실제로 시뮬레이션하려면 이 컨텍스트가 필요하다.
 */
export interface NaverSeoSimulationContext {
  productId: string;
  keyword: string;
  baseline: { rankHistory: number[]; ordersHistory?: number[]; price: number };
  titleScoreBefore: number;
  titleScoreAfter: number;
  targetRank?: number;
  iterations?: number;
  seed?: number;
  horizonDays?: number;
}

/**
 * MonteCarloPredictor 인터페이스를 기존 rw_decision_engine(Python/FastAPI,
 * D:\Claude\MonteCarloDecisionEngine, 기본 포트 8765)의 실제 시뮬레이션 엔드포인트로 채우는 어댑터.
 *
 * 그 엔드포인트는 "상품명 변경 1건에 대한 순위/CTR 영향"만 시뮬레이션하므로,
 * - CHANGE_PRODUCT_NAME 시나리오 + context가 모두 있으면 실제 엔진을 호출한다.
 * - 그 외 액션(ADD_FAQ, IMPROVE_CONTENT 등)이나 context가 없는 경우에는 호출자가 이미 제공한
 *   estimatedImpactRange/probabilityDistribution을 정규분포 근사로 변환해 추정치를 만든다.
 *   이 경우는 "실제 시뮬레이션 아님"을 assumptions/warnings에 명시한다 (근거 없는 정확도 주장 금지).
 */
export class MonteCarloHttpAdapter implements MonteCarloPredictor {
  private readonly baseUrl: string;
  private readonly apiPrefix: string;
  private readonly timeoutMs: number;

  constructor(options: MonteCarloHttpAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiPrefix = options.apiPrefix ?? "/api/v1";
    this.timeoutMs = options.timeoutMs ?? 10000;
  }

  async predict(scenarios: SeoActionScenario[], context?: unknown): Promise<PredictionResult> {
    const simContext = isNaverSeoSimulationContext(context) ? context : undefined;
    const assumptions: string[] = [];
    const warnings: string[] = [];
    const scenarioResults: ScenarioPrediction[] = [];
    let totalSimulations = 0;

    for (const scenario of scenarios) {
      if (scenario.action === "CHANGE_PRODUCT_NAME" && simContext) {
        try {
          const simulated = await this.simulateProductNameChange(scenario, simContext);
          scenarioResults.push(simulated.scenario);
          totalSimulations += simulated.iterations;
          assumptions.push(
            `CHANGE_PRODUCT_NAME: rw_decision_engine 실제 몬테카를로 시뮬레이션 결과 사용 (iterations=${simulated.iterations})`
          );
          continue;
        } catch (error) {
          warnings.push(
            `CHANGE_PRODUCT_NAME 시뮬레이션 호출 실패, 제공된 가정으로 대체합니다: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      } else if (scenario.action === "CHANGE_PRODUCT_NAME" && !simContext) {
        warnings.push("CHANGE_PRODUCT_NAME 시나리오지만 context(baseline/titleScore)가 없어 실제 엔진을 호출하지 못했습니다.");
      }

      scenarioResults.push(estimateFromProvidedAssumption(scenario));
      assumptions.push(
        `${scenario.action}: 실제 시뮬레이션이 아니라 호출자가 제공한 estimatedImpactRange/probabilityDistribution 기반 근사치입니다.`
      );
    }

    return {
      simulations: totalSimulations,
      scenarios: scenarioResults,
      assumptions,
      warnings
    };
  }

  private async simulateProductNameChange(
    scenario: SeoActionScenario,
    context: NaverSeoSimulationContext
  ): Promise<{ scenario: ScenarioPrediction; iterations: number }> {
    const url = `${this.baseUrl}${this.apiPrefix}/naver-seo/simulate`;
    const distribution = scenario.probabilityDistribution;
    const mode = distribution
      ? distribution.mean
      : (scenario.estimatedImpactRange.min + scenario.estimatedImpactRange.max) / 2;
    const spread =
      distribution?.standardDeviation ?? (scenario.estimatedImpactRange.max - scenario.estimatedImpactRange.min) / 4;

    const body = {
      productId: context.productId,
      keyword: context.keyword,
      horizonDays: context.horizonDays ?? 30,
      iterations: context.iterations ?? 20000,
      seed: context.seed ?? 42,
      baseline: context.baseline,
      candidate: {
        candidateId: `${context.productId}-${scenario.action}`,
        titleScoreBefore: context.titleScoreBefore,
        titleScoreAfter: context.titleScoreAfter,
        estimatedCtrLift: {
          distribution: "triangular",
          min: clampCtrLift(mode - spread * 2),
          mode: clampCtrLift(mode),
          max: clampCtrLift(mode + spread * 2)
        }
      },
      ...(context.targetRank ? { targets: { rankAtOrBelow: context.targetRank } } : {})
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`엔진 응답 오류 (HTTP ${response.status}): ${text.slice(0, 200)}`);
      }

      const payload = (await response.json()) as {
        iterations: number;
        results: {
          probabilityPositiveCtrLift: number;
          expectedCtrLift: { median: number; p10: number; p90: number };
        };
      };

      const probability = payload.results.probabilityPositiveCtrLift;
      const riskLevel = probability >= 0.6 ? "LOW" : probability >= 0.4 ? "MEDIUM" : "HIGH";

      return {
        scenario: {
          action: scenario.action,
          probabilityOfImprovement: probability,
          expectedRankDelta: payload.results.expectedCtrLift.median,
          confidenceInterval: [payload.results.expectedCtrLift.p10, payload.results.expectedCtrLift.p90],
          riskLevel
        },
        iterations: payload.iterations
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

function estimateFromProvidedAssumption(scenario: SeoActionScenario): ScenarioPrediction {
  const distribution = scenario.probabilityDistribution;
  const mean = distribution?.mean ?? (scenario.estimatedImpactRange.min + scenario.estimatedImpactRange.max) / 2;
  const stdDev =
    distribution?.standardDeviation ?? Math.max(0.0001, (scenario.estimatedImpactRange.max - scenario.estimatedImpactRange.min) / 4);

  // 평균이 0보다 클 확률을 정규분포 근사(표준정규 CDF)로 계산한다 - "개선될 확률"의 거친 추정치.
  const z = mean / stdDev;
  const probabilityOfImprovement = normalCdf(z);
  const riskLevel = stdDev > Math.abs(mean) ? "HIGH" : stdDev > Math.abs(mean) / 2 ? "MEDIUM" : "LOW";

  return {
    action: scenario.action,
    probabilityOfImprovement: round(probabilityOfImprovement),
    expectedRankDelta: round(mean),
    confidenceInterval: [round(scenario.estimatedImpactRange.min), round(scenario.estimatedImpactRange.max)],
    riskLevel
  };
}

function isNaverSeoSimulationContext(value: unknown): value is NaverSeoSimulationContext {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<NaverSeoSimulationContext>;
  return (
    typeof candidate.productId === "string" &&
    typeof candidate.keyword === "string" &&
    typeof candidate.baseline === "object" &&
    candidate.baseline !== null &&
    typeof candidate.titleScoreBefore === "number" &&
    typeof candidate.titleScoreAfter === "number"
  );
}

function normalCdf(z: number): number {
  if (!Number.isFinite(z)) {
    return z > 0 ? 1 : 0;
  }
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Abramowitz-Stegun 근사 (오차 1e-7 이내). */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * absX);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
}

function round(value: number, digits = 4): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function clampCtrLift(value: number): number {
  return Math.max(-1, Math.min(1, value));
}
