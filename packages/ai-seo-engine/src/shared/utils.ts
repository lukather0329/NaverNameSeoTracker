import { createHash } from "node:crypto";

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 2): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

export function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
  }
  return sorted[mid] as number;
}

export function standardDeviation(values: number[]): number | null {
  if (values.length < 2) {
    return values.length === 1 ? 0 : null;
  }
  const mean = average(values) as number;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** 분석 입력을 결정적으로 해시해서 metadata.inputHash에 담는다 (동일 입력 재분석 감지, 캐시 키 등에 활용). */
export function hashInput(input: unknown): string {
  const json = JSON.stringify(input, sortedReplacer);
  return createHash("sha256").update(json).digest("hex").slice(0, 16);
}

function sortedReplacer(_key: string, value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.keys(value as object)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = (value as Record<string, unknown>)[key];
        return acc;
      }, {});
  }
  return value;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function countOccurrences(text: string, term: string): number {
  if (!term) {
    return 0;
  }
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = text.match(new RegExp(escaped, "gi"));
  return matches ? matches.length : 0;
}
