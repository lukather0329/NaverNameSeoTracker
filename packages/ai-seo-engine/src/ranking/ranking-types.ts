import type { AnalysisResult } from "../shared/types.js";

export interface RankObservation {
  productId: string;
  keyword: string;
  rank: number | null;
  collectedAt: string;
  page?: number;
  source?: string;
}

export type ChangeEventType =
  | "PRODUCT_NAME"
  | "DETAIL_CONTENT"
  | "CATEGORY"
  | "ATTRIBUTE"
  | "PRICE"
  | "IMAGE"
  | "REVIEW"
  | "AD"
  | "COMPETITOR"
  | "EXTERNAL"
  | "OTHER";

export interface ChangeEvent {
  id: string;
  productId: string;
  type: ChangeEventType;
  occurredAt: string;
  description: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

export type RankingTrend = "STRONG_UP" | "UP" | "STABLE" | "DOWN" | "STRONG_DOWN" | "INSUFFICIENT_DATA";

export interface RankingPeriodStats {
  averageRank: number | null;
  medianRank: number | null;
  volatility: number | null;
  sampleCount: number;
}

export interface RankingCandidateCause {
  changeEventId: string;
  type: string;
  correlationScore: number;
  confidence: number;
  lagHours?: number;
  explanation: string;
}

export interface RankingChangeDetails {
  before: RankingPeriodStats;
  after: RankingPeriodStats;

  rankDelta: number | null;
  percentageChange: number | null;

  trend: RankingTrend;

  detectedChangePoints: string[];

  candidateCauses: RankingCandidateCause[];

  warnings: string[];
}

export type RankingChangeResult = AnalysisResult<RankingChangeDetails>;

export interface RankingChangeInput {
  productId: string;
  keyword: string;
  observations: RankObservation[];
  changeEvents?: ChangeEvent[];
  /** 변경 전/후를 나눌 기준 시각. 생략하면 changeEvents 중 가장 이른 이벤트 시각을 사용한다. */
  splitAt?: string;
}
