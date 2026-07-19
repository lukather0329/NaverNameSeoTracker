import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 4300),
  databaseUrl: process.env.DATABASE_URL ?? "file:./dev.db",
  enableNaverLiveProvider: process.env.ENABLE_NAVER_LIVE_PROVIDER === "true",
  defaultTrackingIntervalMinutes: Number(process.env.RANK_TRACKING_DEFAULT_INTERVAL_MINUTES ?? 30),
  decisionEngineBaseUrl: (process.env.RW_DECISION_ENGINE_BASE_URL ?? "http://127.0.0.1:8765").replace(/\/$/, ""),
  decisionEngineApiPrefix: process.env.RW_DECISION_ENGINE_API_PREFIX ?? "/api/v1",
  decisionEngineTimeoutMs: Number(process.env.RW_DECISION_ENGINE_TIMEOUT_MS ?? 10000)
};
