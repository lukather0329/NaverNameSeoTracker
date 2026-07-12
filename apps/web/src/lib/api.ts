import type { AppSnapshot, SeoTitleCandidateFormInput, TitleApplyInput } from "@naver-seo-tracker/shared";

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

export async function createSeoTitleCandidate(input: SeoTitleCandidateFormInput) {
  const response = await fetch(`${API_BASE_URL}/title-candidates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error("Failed to create SEO title candidate");
  }

  return response.json();
}

export async function applySeoTitle(productId: string, input: TitleApplyInput) {
  const response = await fetch(`${API_BASE_URL}/products/${productId}/apply-title`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error("Failed to apply SEO title");
  }

  return response.json();
}

export async function rollbackSeoTitle(productId: string) {
  const response = await fetch(`${API_BASE_URL}/products/${productId}/rollback-title`, {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Failed to rollback SEO title");
  }

  return response.json();
}
