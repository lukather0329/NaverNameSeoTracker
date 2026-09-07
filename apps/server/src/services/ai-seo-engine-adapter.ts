import type { ChangeEvent, ExperimentStatus, ProductSnapshot, RankObservation, SeoExperiment } from "@makeware/ai-seo-engine";

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

// Prisma의 SeoExperiment 상태값(DRAFT/RUNNING/PAUSED/COMPLETED/FAILED)은
// 엔진의 ExperimentStatus(DRAFT/SCHEDULED/RUNNING/COMPLETED/CANCELLED/ROLLED_BACK)와
// 1:1로 대응하지 않는다. PAUSED는 "실행 중이지만 측정을 멈춘" 상태라 엔진의
// ACTIVE_STATUSES(SCHEDULED/RUNNING) 의미에 가장 가까운 SCHEDULED로,
// FAILED는 "정상 종료가 아닌 중단"이라는 의미가 가장 가까운 ROLLED_BACK으로 매핑한다.
// (엔진 쪽 상태 전이 검증에는 이 매핑 결과를 다시 넣지 않고, 타임라인/비교 등
// 읽기 전용 계산에만 사용한다.)
function mapExperimentStatus(status: string): ExperimentStatus {
  switch (status) {
    case "DRAFT":
      return "DRAFT";
    case "RUNNING":
      return "RUNNING";
    case "PAUSED":
      return "SCHEDULED";
    case "COMPLETED":
      return "COMPLETED";
    case "FAILED":
      return "ROLLED_BACK";
    default:
      return "DRAFT";
  }
}

type SeoExperimentLike = {
  id: string;
  productId: string;
  name: string;
  beforeTitle: string;
  afterTitle: string;
  appliedAt: Date | null;
  startDate: Date;
  endDate: Date | null;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * 기존 SeoExperiment Prisma 모델은 "상품명 변경 실험" 전용으로 설계되어 있어
 * (beforeTitle/afterTitle 문자열만 저장) 엔진의 SeoExperiment 타입이 갖는
 * hypothesis, variableType, baselinePeriod/measurementPeriod,
 * linkedRankingAnalysisIds 등은 대응되는 원본 데이터가 없다. 없는 값을
 * 지어내지 않고 실제로 알 수 있는 값만 채우며, variableType은 이 모델이
 * 상품명 변경 실험 전용이라는 사실 자체가 근거이므로 "PRODUCT_NAME"으로 고정한다.
 */
export function mapSeoExperimentToEngineExperiment(
  experiment: SeoExperimentLike,
  targetKeywords: string[] = []
): SeoExperiment {
  const beforeSnapshot: ProductSnapshot = { productName: experiment.beforeTitle };
  const afterSnapshot: ProductSnapshot = { productName: experiment.afterTitle };

  return {
    id: experiment.id,
    productId: experiment.productId,
    name: experiment.name,
    hypothesis:
      experiment.notes?.trim() ||
      `상품명을 "${experiment.beforeTitle}"에서 "${experiment.afterTitle}"(으)로 변경하면 순위/노출이 달라질 것으로 예상`,
    status: mapExperimentStatus(experiment.status),
    variableType: "PRODUCT_NAME",
    beforeSnapshot,
    afterSnapshot,
    // startDate는 Prisma 스키마상 필수값이라 항상 존재하지만 "실제로 시작됐다"는 뜻이
    // 아니다(DRAFT 상태에서도 채워져 있음). appliedAt이 없고 아직 DRAFT라면 실제로
    // 시작되지 않은 것이므로 startedAt을 비워 엔진의 buildTimeline이 허위 "실험 시작"
    // 이벤트를 만들지 않게 한다.
    startedAt:
      experiment.appliedAt?.toISOString() ??
      (experiment.status === "DRAFT" ? undefined : experiment.startDate.toISOString()),
    endedAt: experiment.endDate?.toISOString(),
    targetKeywords,
    linkedRankingAnalysisIds: [],
    notes: experiment.notes ?? undefined,
    createdAt: experiment.createdAt.toISOString(),
    updatedAt: experiment.updatedAt.toISOString()
  };
}
