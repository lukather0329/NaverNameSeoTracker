import type { ApiAccountFormInput, AppSnapshot } from "@naver-seo-tracker/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4300/api";

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

export async function testApiAccountConnection(accountId: string) {
  const response = await fetch(`${API_BASE_URL}/accounts/${accountId}/test`, {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Failed to test API account");
  }

  return response.json();
}

export async function startExperiment(experimentId: string) {
  return postJson(`${API_BASE_URL}/experiments/${experimentId}/start`, {});
}

export async function pauseExperiment(experimentId: string) {
  return postJson(`${API_BASE_URL}/experiments/${experimentId}/pause`, {});
}

export async function completeExperiment(experimentId: string) {
  return postJson(`${API_BASE_URL}/experiments/${experimentId}/complete`, {});
}

export async function applyProductTitle(productId: string, input: { afterTitle: string; reason?: string }) {
  return postJson(`${API_BASE_URL}/products/${productId}/title/apply`, {
    ...input,
    mode: "VALIDATION",
    confirmed: true
  });
}

export async function rollbackProductTitle(productId: string, reason?: string) {
  return postJson(`${API_BASE_URL}/products/${productId}/title/rollback`, {
    confirmed: true,
    reason
  });
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }

  return response.json();
}
