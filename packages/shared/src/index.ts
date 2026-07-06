export type ApiAccountType = "COMMERCE" | "SEARCH_AD" | "CUSTOM";
export type ConnectionStatus = "CONNECTED" | "FAILED" | "UNVERIFIED" | "EXPIRED";
export type ProductStatus = "ON_SALE" | "PAUSED" | "SOLD_OUT";
export type TestStatus = "DRAFT" | "RUNNING" | "PAUSED" | "COMPLETED" | "FAILED";
export type RankDeltaStatus = "UP" | "DOWN" | "SAME" | "OUT";
export type ExperimentJudgement = "EFFECTIVE" | "LOW_EFFECT" | "PENDING" | "WORSE";
export type TrackingInterval = "30_MINUTES" | "60_MINUTES";
export type RankProviderKind = "MOCK" | "NAVER_SHOPPING" | "FUTURE_API";

export interface ApiAccount {
  id: string;
  name: string;
  type: ApiAccountType;
  clientIdMasked: string;
  clientSecretMasked: string;
  accessLicenseMasked?: string | null;
  secretKeyMasked?: string | null;
  customerId?: string | null;
  storeId?: string | null;
  channelId?: string | null;
  isActive: boolean;
  lastCheckedAt?: string | null;
  connectionStatus: ConnectionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ApiAccountFormInput {
  name: string;
  type: ApiAccountType;
  clientId: string;
  clientSecret: string;
  accessLicense?: string;
  secretKey?: string;
  customerId?: string;
  storeId?: string;
  channelId?: string;
  isActive: boolean;
}

export interface Product {
  id: string;
  smartStoreProductId: string;
  originProductId?: string | null;
  channelProductId?: string | null;
  sellerManagementCode?: string | null;
  currentTitle: string;
  originalTitle?: string | null;
  seoOptimizedTitle?: string | null;
  primaryKeyword?: string | null;
  trackingKeywords: string[];
  category?: string | null;
  price: number;
  productStatus: ProductStatus;
  testStatus: TestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SeoTitleCandidate {
  id: string;
  productId: string;
  source: "MANUAL" | "CSV" | "MVP_ADAPTER";
  title: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TitleChangeLog {
  id: string;
  productId: string;
  beforeTitle: string;
  afterTitle: string;
  appliedAt?: string | null;
  mode: "VALIDATION" | "LIVE";
  result: "PENDING" | "SUCCESS" | "FAILED" | "ROLLED_BACK";
  reason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RankTrackingJob {
  id: string;
  experimentId: string;
  productId: string;
  keyword: string;
  interval: TrackingInterval;
  provider: RankProviderKind;
  isEnabled: boolean;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  status: TestStatus;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RankTrackingResult {
  id: string;
  jobId: string;
  experimentId: string;
  productId: string;
  keyword: string;
  trackedAt: string;
  currentRank?: number | null;
  previousRank?: number | null;
  initialRank?: number | null;
  beforeTitleRank?: number | null;
  delta?: number | null;
  deltaStatus: RankDeltaStatus;
  searchPage?: number | null;
  foundTitle?: string | null;
  foundProductRef?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SeoExperiment {
  id: string;
  name: string;
  productId: string;
  beforeTitle: string;
  afterTitle: string;
  appliedAt?: string | null;
  trackingInterval: TrackingInterval;
  startDate: string;
  endDate?: string | null;
  status: TestStatus;
  summary?: string | null;
  judgement: ExperimentJudgement;
  minObservationHours: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardSummary {
  runningExperiments: number;
  upCount: number;
  downCount: number;
  sameCount: number;
  avgRankDelta: number;
  last24hPoints: Array<{ label: string; up: number; down: number; same: number }>;
}

export interface AppSnapshot {
  dashboard: DashboardSummary;
  apiAccounts: ApiAccount[];
  products: Product[];
  seoTitleCandidates: SeoTitleCandidate[];
  titleChangeLogs: TitleChangeLog[];
  experiments: SeoExperiment[];
  jobs: RankTrackingJob[];
  results: RankTrackingResult[];
}
