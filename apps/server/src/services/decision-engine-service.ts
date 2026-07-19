import { config } from "../lib/config.js";

export type DecisionProjectionProduct = {
  id: string;
  smartStoreProductId: string;
  currentTitle: string;
  seoOptimizedTitle?: string | null;
  primaryKeyword?: string | null;
  trackingKeywords: string[];
  category?: string | null;
  price: number;
};

export type DecisionProjectionHistoryRow = {
  currentRank?: number | null;
};

export type DecisionProjectionInput = {
  seoTitle?: string;
  primaryKeyword?: string;
  trackingKeywords?: string[];
  targetRank?: number;
  iterations?: number;
  seed?: number;
  horizonDays?: number;
};

export type DecisionProjectionResponse = {
  ok: true;
  inputSummary: {
    keyword: string;
    rankHistoryCount: number;
    ordersHistoryCount: number;
    titleScoreBefore: number;
    titleScoreAfter: number;
    targetRank: number | null;
    usedRankSensitivity: boolean;
  };
  projection: {
    simulationId: string;
    modelName: string;
    modelVersion: string;
    seed: number;
    iterations: number;
    confidence: "low" | "medium" | "high";
    results: {
      probabilityPositiveCtrLift: number;
      probabilityTargetRank: number | null;
      expectedCtrLift: { median: number; p10: number; p90: number };
      expectedOrders: { median: number; p10: number; p90: number };
    };
    warnings: string[];
    recommendation: {
      status: "adopt_candidate" | "keep_baseline" | "continue_observation";
      additionalObservationDays: number | null;
    };
  };
  requestPayload: Record<string, unknown>;
};

type EngineResponse = DecisionProjectionResponse["projection"];

type DistributionAssumption = {
  distribution: "triangular";
  min: number;
  mode: number;
  max: number;
};

export async function runDecisionProjection(params: {
  product: DecisionProjectionProduct;
  history: DecisionProjectionHistoryRow[];
  input: DecisionProjectionInput;
}): Promise<DecisionProjectionResponse> {
  const requestPayload = buildDecisionPayload(params.product, params.history, params.input);
  const url = `${config.decisionEngineBaseUrl}${config.decisionEngineApiPrefix}/naver-seo/simulate`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.decisionEngineTimeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal
    });

    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (!response.ok) {
      const message =
        typeof payload?.error === "string"
          ? payload.error
          : Array.isArray(payload?.detail)
            ? "의사결정 엔진 요청 형식이 올바르지 않습니다."
            : "의사결정 엔진 호출에 실패했습니다.";
      throw new Error(message);
    }

    const projection = payload as unknown as EngineResponse;

    return {
      ok: true,
      inputSummary: {
        keyword: String(requestPayload.keyword ?? ""),
        rankHistoryCount: Array.isArray((requestPayload.baseline as { rankHistory?: number[] } | undefined)?.rankHistory)
          ? ((requestPayload.baseline as { rankHistory?: number[] }).rankHistory?.length ?? 0)
          : 0,
        ordersHistoryCount: Array.isArray((requestPayload.baseline as { ordersHistory?: number[] } | undefined)?.ordersHistory)
          ? ((requestPayload.baseline as { ordersHistory?: number[] }).ordersHistory?.length ?? 0)
          : 0,
        titleScoreBefore: Number((requestPayload.candidate as { titleScoreBefore?: number } | undefined)?.titleScoreBefore ?? 0),
        titleScoreAfter: Number((requestPayload.candidate as { titleScoreAfter?: number } | undefined)?.titleScoreAfter ?? 0),
        targetRank: typeof (requestPayload.targets as { rankAtOrBelow?: number } | undefined)?.rankAtOrBelow === "number"
          ? Number((requestPayload.targets as { rankAtOrBelow?: number }).rankAtOrBelow)
          : null,
        usedRankSensitivity: Boolean((requestPayload.candidate as { rankSensitivity?: DistributionAssumption } | undefined)?.rankSensitivity)
      },
      projection,
      requestPayload
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("의사결정 엔진 응답 시간이 초과되었습니다.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildDecisionPayload(product: DecisionProjectionProduct, history: DecisionProjectionHistoryRow[], input: DecisionProjectionInput) {
  const seoTitle = input.seoTitle?.trim() || product.seoOptimizedTitle?.trim() || product.currentTitle;
  const primaryKeyword = input.primaryKeyword?.trim() || product.primaryKeyword?.trim() || "";
  const trackingKeywords = Array.from(new Set((input.trackingKeywords ?? product.trackingKeywords).map((item) => item.trim()).filter(Boolean)));
  const keyword = primaryKeyword || trackingKeywords[0] || product.currentTitle.split(/\s+/)[0] || product.smartStoreProductId;
  const rankHistory = history
    .map((item) => item.currentRank)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .slice(0, 20)
    .reverse();
  const titleScoreBefore = scoreTitle(product.currentTitle, primaryKeyword, trackingKeywords);
  const titleScoreAfter = scoreTitle(seoTitle, primaryKeyword, trackingKeywords);
  const scoreDelta = Math.max(-25, Math.min(25, titleScoreAfter - titleScoreBefore));
  const estimatedCtrLift = buildCtrLiftDistribution(scoreDelta, trackingKeywords.length);
  const targetRank = typeof input.targetRank === "number" && Number.isFinite(input.targetRank) ? input.targetRank : null;
  const rankSensitivity = targetRank !== null ? buildRankSensitivity(scoreDelta, rankHistory) : undefined;

  return {
    productId: product.id,
    keyword,
    horizonDays: input.horizonDays ?? 30,
    iterations: input.iterations ?? 30000,
    seed: input.seed ?? 42871,
    baseline: {
      rankHistory,
      ordersHistory: [] as number[],
      price: product.price
    },
    candidate: {
      candidateId: `${product.id}-seo-title`,
      titleScoreBefore,
      titleScoreAfter,
      estimatedCtrLift,
      ...(rankSensitivity ? { rankSensitivity } : {})
    },
    ...(targetRank !== null ? { targets: { rankAtOrBelow: targetRank } } : {})
  };
}

function scoreTitle(title: string, primaryKeyword: string, trackingKeywords: string[]) {
  const normalizedTitle = title.toLowerCase();
  let score = 52;
  if (primaryKeyword && normalizedTitle.includes(primaryKeyword.toLowerCase())) score += 18;
  const matchedTracking = trackingKeywords.filter((keyword) => normalizedTitle.includes(keyword.toLowerCase())).length;
  score += Math.min(18, matchedTracking * 5);
  if (title.length >= 18 && title.length <= 42) score += 8;
  if (title.length > 52) score -= 8;
  if (new Set(title.split(/\s+/).filter(Boolean)).size >= 4) score += 4;
  return Math.max(35, Math.min(98, score));
}

function buildCtrLiftDistribution(scoreDelta: number, keywordCount: number): DistributionAssumption {
  const keywordBonus = Math.min(0.04, keywordCount * 0.008);
  const mode = clamp(scoreDelta * 0.012 + keywordBonus, -0.04, 0.22);
  const min = clamp(mode - 0.08, -0.12, 0.12);
  const max = clamp(mode + 0.14, 0.04, 0.32);
  return {
    distribution: "triangular",
    min,
    mode,
    max: Math.max(mode + 0.01, max)
  };
}

function buildRankSensitivity(scoreDelta: number, rankHistory: number[]) {
  const baselineRank = rankHistory.length > 0 ? rankHistory.reduce((sum, value) => sum + value, 0) / rankHistory.length : 40;
  const improvementScale = Math.max(3, Math.round(scoreDelta * 0.45 + Math.max(0, (baselineRank - 20) * 0.08)));
  return {
    distribution: "triangular" as const,
    min: -Math.max(improvementScale + 7, 6),
    mode: -Math.max(improvementScale, 3),
    max: Math.max(2, Math.round(improvementScale * 0.35))
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
