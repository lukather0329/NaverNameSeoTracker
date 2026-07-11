import type { AppSnapshot, ProductFormInput } from "@naver-seo-tracker/shared";

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

export async function createProduct(input: ProductFormInput) {
  const response = await fetch(`${API_BASE_URL}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error("Failed to create product");
  }

  return response.json();
}

export async function updateProduct(productId: string, input: Partial<ProductFormInput>) {
  const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error("Failed to update product");
  }

  return response.json();
}

export async function bulkCreateProducts(rows: ProductFormInput[]) {
  const response = await fetch(`${API_BASE_URL}/products/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows })
  });

  if (!response.ok) {
    throw new Error("Failed to bulk create products");
  }

  return response.json();
}
