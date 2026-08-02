export type ExperimentStatus = "DRAFT" | "SCHEDULED" | "RUNNING" | "COMPLETED" | "CANCELLED" | "ROLLED_BACK";

export type ExperimentVariableType =
  | "PRODUCT_NAME"
  | "DETAIL_CONTENT"
  | "CATEGORY"
  | "ATTRIBUTE"
  | "PRICE"
  | "IMAGE"
  | "REVIEW"
  | "AD"
  | "OTHER";

export interface DateRange {
  start: string;
  end: string;
}

export interface ProductSnapshot {
  productName?: string;
  category?: string;
  price?: number;
  salePrice?: number;
  attributes?: Record<string, unknown>;
  detailContentHash?: string;
  imageUrls?: string[];
  adEnabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface SeoExperiment {
  id: string;
  productId: string;
  name: string;
  hypothesis: string;

  status: ExperimentStatus;
  variableType: ExperimentVariableType;

  beforeSnapshot: ProductSnapshot;
  afterSnapshot: ProductSnapshot;

  startedAt?: string;
  endedAt?: string;

  targetKeywords: string[];

  baselinePeriod?: DateRange;
  measurementPeriod?: DateRange;

  /** 이 실험과 연결된 Ranking Change Detector 분석 결과의 참조 ID들 (느슨한 결합, 실제 객체는 저장하지 않음). */
  linkedRankingAnalysisIds?: string[];

  notes?: string;

  createdAt: string;
  updatedAt: string;
}

export interface CreateExperimentInput {
  productId: string;
  name: string;
  hypothesis: string;
  variableType: ExperimentVariableType;
  beforeSnapshot: ProductSnapshot;
  afterSnapshot: ProductSnapshot;
  targetKeywords?: string[];
  baselinePeriod?: DateRange;
  measurementPeriod?: DateRange;
  notes?: string;
}

export interface SnapshotDiffEntry {
  field: string;
  before: unknown;
  after: unknown;
}

export interface SnapshotComparison {
  changedFields: SnapshotDiffEntry[];
  hasChanges: boolean;
}

export interface ExperimentTimelineEntry {
  experimentId: string;
  name: string;
  status: ExperimentStatus;
  at: string;
  label: string;
}
