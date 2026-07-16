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
