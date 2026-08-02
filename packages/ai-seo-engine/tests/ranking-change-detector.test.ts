import { describe, expect, it } from "vitest";
import { RankingChangeDetector } from "../src/ranking/ranking-change-detector.js";
import { ValidationError } from "../src/shared/errors.js";
import type { ChangeEvent, RankObservation } from "../src/ranking/ranking-types.js";

const BASE_DATE = "2026-01-01T00:00:00.000Z";

function buildObservations(ranks: Array<number | null>, startDate = BASE_DATE, intervalHours = 24): RankObservation[] {
  return ranks.map((rank, i) => ({
    productId: "product-1",
    keyword: "코딩드론",
    rank,
    collectedAt: new Date(new Date(startDate).getTime() + i * intervalHours * 60 * 60 * 1000).toISOString()
  }));
}

function buildEvent(overrides: Partial<ChangeEvent> = {}): ChangeEvent {
  return {
    id: overrides.id ?? "event-1",
    productId: "product-1",
    type: "PRODUCT_NAME",
    occurredAt: "2026-01-10T00:00:00.000Z",
    description: "상품명 변경",
    ...overrides
  };
}

function findCode(codes: Array<{ code: string }>, code: string) {
  return codes.some((item) => item.code === code);
}

describe("RankingChangeDetector", () => {
  const detector = new RankingChangeDetector();

  it("지속 상승 패턴을 STRONG_UP 또는 UP으로 분류한다", async () => {
    const before = buildObservations([52, 50, 51, 49, 53, 50, 48, 51], "2025-12-25T00:00:00.000Z");
    const after = buildObservations([20, 19, 21, 18, 20, 19, 20, 18], "2026-01-10T00:00:00.000Z");
    const result = await detector.analyze({
      productId: "product-1",
      keyword: "코딩드론",
      observations: [...before, ...after],
      changeEvents: [buildEvent()]
    });
    expect(["STRONG_UP", "UP"]).toContain(result.details.trend);
    expect(findCode(result.strengths, "SUSTAINED_IMPROVEMENT")).toBe(true);
  });

  it("일시적 상승 패턴은 경고를 남긴다", async () => {
    const before = buildObservations([50, 49, 51, 50, 48, 50, 51, 49], "2025-12-25T00:00:00.000Z");
    const after = buildObservations([15, 16, 17, 40, 42, 44, 45, 46], "2026-01-10T00:00:00.000Z");
    const result = await detector.analyze({
      productId: "product-1",
      keyword: "코딩드론",
      observations: [...before, ...after],
      changeEvents: [buildEvent()]
    });
    expect(result.details.warnings.some((w) => w.includes("일시적"))).toBe(true);
  });

  it("지속 하락 패턴을 DOWN 또는 STRONG_DOWN으로 분류한다", async () => {
    const before = buildObservations([10, 11, 9, 10, 12, 10, 9, 11], "2025-12-25T00:00:00.000Z");
    const after = buildObservations([45, 48, 46, 50, 47, 49, 46, 48], "2026-01-10T00:00:00.000Z");
    const result = await detector.analyze({
      productId: "product-1",
      keyword: "코딩드론",
      observations: [...before, ...after],
      changeEvents: [buildEvent()]
    });
    expect(["DOWN", "STRONG_DOWN"]).toContain(result.details.trend);
    expect(findCode(result.weaknesses, "RANK_WORSENED")).toBe(true);
  });

  it("변화가 거의 없으면 STABLE로 분류한다", async () => {
    const before = buildObservations([30, 31, 29, 30, 32, 30, 29, 31], "2025-12-25T00:00:00.000Z");
    const after = buildObservations([31, 30, 32, 31, 29, 31, 30, 32], "2026-01-10T00:00:00.000Z");
    const result = await detector.analyze({
      productId: "product-1",
      keyword: "코딩드론",
      observations: [...before, ...after],
      changeEvents: [buildEvent()]
    });
    expect(result.details.trend).toBe("STABLE");
  });

  it("표본이 부족하면 INSUFFICIENT_DATA로 분류한다", async () => {
    const observations = buildObservations([10, 20], "2026-01-01T00:00:00.000Z");
    const result = await detector.analyze({
      productId: "product-1",
      keyword: "코딩드론",
      observations,
      changeEvents: [buildEvent({ occurredAt: "2026-01-01T12:00:00.000Z" })]
    });
    expect(result.details.trend).toBe("INSUFFICIENT_DATA");
  });

  it("순위 null이 많으면 누락률 경고를 남긴다", async () => {
    const observations = buildObservations([10, null, null, null, 20, null, null, 25, null, null]);
    const result = await detector.analyze({
      productId: "product-1",
      keyword: "코딩드론",
      observations
    });
    expect(result.details.warnings.some((w) => w.includes("누락률"))).toBe(true);
  });

  it("변경 이벤트가 1개면 candidateCauses도 1개다", async () => {
    const before = buildObservations([50, 49, 51, 48], "2025-12-25T00:00:00.000Z");
    const after = buildObservations([20, 19, 21, 18], "2026-01-10T00:00:00.000Z");
    const result = await detector.analyze({
      productId: "product-1",
      keyword: "코딩드론",
      observations: [...before, ...after],
      changeEvents: [buildEvent()]
    });
    expect(result.details.candidateCauses).toHaveLength(1);
    expect(result.details.candidateCauses[0]?.changeEventId).toBe("event-1");
  });

  it("변경 이벤트가 여러 개 겹치면 경고를 남긴다", async () => {
    const observations = buildObservations(
      Array.from({ length: 20 }, (_, i) => 50 - i),
      "2025-12-25T00:00:00.000Z"
    );
    const result = await detector.analyze({
      productId: "product-1",
      keyword: "코딩드론",
      observations,
      changeEvents: [
        buildEvent({ id: "event-1", type: "PRODUCT_NAME", occurredAt: "2026-01-01T00:00:00.000Z" }),
        buildEvent({ id: "event-2", type: "DETAIL_CONTENT", occurredAt: "2026-01-02T00:00:00.000Z" })
      ]
    });
    expect(result.details.candidateCauses).toHaveLength(2);
    expect(result.details.warnings.some((w) => w.includes("겹쳐"))).toBe(true);
  });

  it("변경 후 지연되어 개선되는 패턴에서 lagHours가 0보다 크게 나올 수 있다", async () => {
    const observations = buildObservations(
      [50, 49, 51, 50, 48, 47, 20, 19],
      "2026-01-01T00:00:00.000Z"
    );
    const result = await detector.analyze({
      productId: "product-1",
      keyword: "코딩드론",
      observations,
      changeEvents: [buildEvent({ occurredAt: "2026-01-04T00:00:00.000Z" })]
    });
    expect(result.details.candidateCauses[0]).toBeDefined();
    expect(result.details.candidateCauses[0]?.lagHours).toBeGreaterThanOrEqual(0);
  });

  it("변동성이 과도하면 HIGH_VOLATILITY 약점을 반환한다", async () => {
    const before = buildObservations([50, 49, 51, 50], "2025-12-25T00:00:00.000Z");
    const after = buildObservations([5, 50, 10, 45, 8, 48, 12, 42], "2026-01-10T00:00:00.000Z");
    const result = await detector.analyze({
      productId: "product-1",
      keyword: "코딩드론",
      observations: [...before, ...after],
      changeEvents: [buildEvent()]
    });
    expect(findCode(result.weaknesses, "HIGH_VOLATILITY")).toBe(true);
  });

  it("observations가 비어 있으면 ValidationError를 던진다", async () => {
    await expect(
      detector.analyze({ productId: "product-1", keyword: "코딩드론", observations: [] })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("changeEvents와 splitAt이 모두 없으면 데이터 부족 경고를 남긴다", async () => {
    const observations = buildObservations([10, 20, 30, 40]);
    const result = await detector.analyze({
      productId: "product-1",
      keyword: "코딩드론",
      observations
    });
    expect(result.details.warnings.some((w) => w.includes("변경 시점"))).toBe(true);
  });
});
