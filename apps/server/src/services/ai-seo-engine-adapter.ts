import type { ChangeEvent, RankObservation } from "@makeware/ai-seo-engine";

/**
 * ai-seo-engine 패키지는 Prisma를 전혀 모르는 독립 패키지이므로,
 * 기존 Prisma 모델(RankTrackingResult, TitleChangeLog)을 엔진의 입력 타입으로
 * 매핑하는 어댑터를 서버 쪽에 둔다. 순위 수집 방식(자동/수동)이 나중에 바뀌어도
 * 이 어댑터의 입력 타입만 맞으면 그대로 재사용할 수 있다.
 */

type RankTrackingResultLike = {
  productId: string;
  keyword: string;
  currentRank: number | null;
  trackedAt: Date;
  searchPage: number | null;
};

export function mapRankTrackingResultsToObservations(
  results: RankTrackingResultLike[],
  source?: string
): RankObservation[] {
  return results.map((result) => ({
    productId: result.productId,
    keyword: result.keyword,
    rank: result.currentRank,
    collectedAt: result.trackedAt.toISOString(),
    page: result.searchPage ?? undefined,
    source
  }));
}

type TitleChangeLogLike = {
  id: string;
  productId: string;
  beforeTitle: string;
  afterTitle: string;
  appliedAt: Date | null;
  createdAt: Date;
  mode: string;
  result: string;
};

export function mapTitleChangeLogsToChangeEvents(logs: TitleChangeLogLike[]): ChangeEvent[] {
  return logs
    .filter((log) => log.result === "SUCCESS")
    .map((log) => ({
      id: log.id,
      productId: log.productId,
      type: "PRODUCT_NAME",
      occurredAt: (log.appliedAt ?? log.createdAt).toISOString(),
      description: `상품명 변경: "${log.beforeTitle}" → "${log.afterTitle}"`,
      before: log.beforeTitle,
      after: log.afterTitle,
      metadata: { mode: log.mode }
    }));
}
