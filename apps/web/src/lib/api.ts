import type { ApiAccountFormInput, AppSnapshot } from "@naver-seo-tracker/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4300/api";

export type ApiConnectionTestResponse = {
  ok: boolean;
  message: string;
  mode?: string;
  statusCode?: number;
  details?: string;
};

export type CreateExperimentDraftInput = {
  name: string;
  productId: string;
  beforeTitle: string;
  afterTitle: string;
  trackingInterval: "30_MINUTES" | "60_MINUTES";
  startDate: string;
  endDate?: string;
  minObservationHours?: number;
  notes?: string;
};

export type UpdateProductInput = {
  seoOptimizedTitle?: string;
  primaryKeyword?: string;
  trackingKeywords?: string[];
};

export type ProductImportResponse = {
  ok: boolean;
  message: string;
  accountId: string;
  accountName: string;
  sellerIdentifier: string;
  totalFetched: number;
  importedCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  pageCount: number;
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

export async function fetchSnapshot(): Promise<AppSnapshot> {
  const response = await fetch(`${API_BASE_URL}/snapshot`);

  if (!response.ok) {
    throw new Error("Failed to fetch snapshot");
  }

  return response.json();
}

export async function runTrackingJob(jobId: string) {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/run`, {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Failed to run job");
  }

  return response.json();
}

export async function createApiAccount(input: ApiAccountFormInput) {
  const response = await fetch(`${API_BASE_URL}/accounts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error("Failed to create API account");
  }

  return response.json();
}

export async function updateApiAccount(accountId: string, input: Partial<ApiAccountFormInput>) {
  const response = await fetch(`${API_BASE_URL}/accounts/${accountId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error("Failed to update API account");
  }

  return response.json();
}

export async function testApiAccountConnection(accountId: string): Promise<ApiConnectionTestResponse> {
  const response = await fetch(`${API_BASE_URL}/accounts/${accountId}/test`, {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Failed to test API account");
  }

  return response.json();
}

export async function importCommerceProducts(apiAccountId?: string): Promise<ProductImportResponse> {
  const response = await fetch(`${API_BASE_URL}/products/import/naver-commerce`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(apiAccountId ? { apiAccountId } : {})
  });

  const payload = (await response.json().catch(() => null)) as ProductImportResponse | { ok?: boolean; message?: string } | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.message ?? "스마트스토어 상품 불러오기에 실패했습니다.");
  }

  return payload as ProductImportResponse;
}

export async function createExperimentDraft(input: CreateExperimentDraftInput) {
  const response = await fetch(`${API_BASE_URL}/experiments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error("Failed to create experiment draft");
  }

  return response.json();
}

export async function updateProduct(productId: string, input: UpdateProductInput) {
  const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error("Failed to update product");
  }

  return response.json();
}

export async function runDecisionProjection(productId: string, input: DecisionProjectionInput): Promise<DecisionProjectionResponse> {
  const response = await fetch(`${API_BASE_URL}/products/${productId}/decision-projection`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  const payload = (await response.json().catch(() => null)) as DecisionProjectionResponse | { ok?: boolean; message?: string } | null;

  if (!response.ok || !payload || ("ok" in payload && payload.ok !== true)) {
    throw new Error((payload as { message?: string } | null)?.message ?? "의사결정 엔진 분석을 실행하지 못했습니다.");
  }

  return payload as DecisionProjectionResponse;
}
