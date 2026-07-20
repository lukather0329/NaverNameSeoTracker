import type { DashboardSummary } from "@naver-seo-tracker/shared";
import { prisma } from "../lib/prisma.js";

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [runningExperiments, latestResults] = await Promise.all([
    prisma.seoExperiment.count({
      where: { status: "RUNNING" }
    }),
    prisma.rankTrackingResult.findMany({
      where: {
        trackedAt: {
          gte: since
        }
      },
      orderBy: { trackedAt: "desc" },
      take: 500
    })
  ]);

  const upCount = latestResults.filter((item) => item.deltaStatus === "UP").length;
  const downCount = latestResults.filter((item) => item.deltaStatus === "DOWN").length;
  const sameCount = latestResults.filter((item) => item.deltaStatus === "SAME").length;
  const deltaValues = latestResults.map((item) => item.delta ?? 0);
  const avgRankDelta = deltaValues.length
    ? Number((deltaValues.reduce((sum, value) => sum + value, 0) / deltaValues.length).toFixed(2))
    : 0;

  const last24hPoints = Array.from({ length: 8 }, (_, index) => {
    const bucketStart = new Date(since.getTime() + index * 3 * 60 * 60 * 1000);
    const bucketEnd = new Date(bucketStart.getTime() + 3 * 60 * 60 * 1000);
    const chunk = latestResults.filter((item) => item.trackedAt >= bucketStart && item.trackedAt < bucketEnd);

    return {
      label: `${24 - index * 3}h`,
      up: chunk.filter((item) => item.deltaStatus === "UP").length,
      down: chunk.filter((item) => item.deltaStatus === "DOWN").length,
      same: chunk.filter((item) => item.deltaStatus === "SAME").length
    };
  });

  return {
    runningExperiments,
    upCount,
    downCount,
    sameCount,
    avgRankDelta,
    last24hPoints
  };
}
