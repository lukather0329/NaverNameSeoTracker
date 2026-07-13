import type { AppSnapshot, RankTrackingJobFormInput } from "@naver-seo-tracker/shared";

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

export async function createTrackingJob(input: RankTrackingJobFormInput) {
  const response = await fetch(`${API_BASE_URL}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error("Failed to create tracking job");
  }

  return response.json();
}

export async function updateTrackingJob(jobId: string, input: Partial<RankTrackingJobFormInput>) {
  const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error("Failed to update tracking job");
  }

  return response.json();
}
