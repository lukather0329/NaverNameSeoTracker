import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 4300),
  databaseUrl: process.env.DATABASE_URL ?? "file:./dev.db",
  encryptionSecret: process.env.ENCRYPTION_SECRET ?? "local-development-secret",
  enableNaverLiveProvider: process.env.ENABLE_NAVER_LIVE_PROVIDER === "true",
  defaultTrackingIntervalMinutes: Number(process.env.RANK_TRACKING_DEFAULT_INTERVAL_MINUTES ?? 30)
};
