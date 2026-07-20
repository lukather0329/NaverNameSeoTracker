import { prisma } from "../lib/prisma.js";
import type { Prisma } from "@prisma/client";
import { MockRankProvider } from "../providers/mock-rank-provider.js";
import { NaverShoppingRankProvider } from "../providers/naver-shopping-rank-provider.js";
import type { RankProvider } from "../providers/rank-provider.js";
import { writeSystemLog } from "./system-log-service.js";

const runningJobIds = new Set<string>();

type RankTrackingJobWithProduct = Prisma.RankTrackingJobGetPayload<{ include: { product: true } }>;

function resolveProvider(provider: string): RankProvider {
  if (provider === "NAVER_SHOPPING") {
    return new NaverShoppingRankProvider();
  }

  return new MockRankProvider();
}

function getNextRunAt(interval: string) {
  const minutes = interval === "60_MINUTES" ? 60 : 30;
  return new Date(Date.now() + minutes * 60 * 1000);
}

export async function runTrackingJob(jobId: string, options: { force?: boolean } = {}) {
  if (runningJobIds.has(jobId)) {
    await writeSystemLog({
      level: "WARN",
      scope: "rank-job.lock",
      message: "Skipped duplicate rank tracking job run",
      meta: { jobId }
    });
    return null;
  }

  runningJobIds.add(jobId);

  let job: RankTrackingJobWithProduct | null = null;
  try {
    job = await prisma.rankTrackingJob.findUnique({
      where: { id: jobId },
      include: {
        product: true
      }
    });

    if (!job || !job.isEnabled) {
      return null;
    }

    const now = new Date();

    if (!options.force && job.nextRunAt && job.nextRunAt > now) {
      return null;
    }

    const provider = resolveProvider(job.provider);
    const lookup = await provider.lookup({
      keyword: job.keyword,
      productId: job.productId,
      currentTitle: job.product.currentTitle
    });

    const previous = await prisma.rankTrackingResult.findFirst({
      where: { jobId: job.id },
      orderBy: { trackedAt: "desc" }
    });

    const delta =
      typeof previous?.currentRank === "number" && typeof lookup.currentRank === "number"
        ? previous.currentRank - lookup.currentRank
        : null;

    const deltaStatus =
      lookup.currentRank === null
        ? "OUT"
        : delta === null
          ? "SAME"
          : delta > 0
            ? "UP"
            : delta < 0
              ? "DOWN"
              : "SAME";

    const result = await prisma.rankTrackingResult.create({
      data: {
        jobId: job.id,
        experimentId: job.experimentId,
        productId: job.productId,
        keyword: job.keyword,
        trackedAt: now,
        currentRank: lookup.currentRank,
        previousRank: previous?.currentRank ?? null,
        initialRank: previous?.initialRank ?? previous?.currentRank ?? lookup.currentRank,
        beforeTitleRank: previous?.beforeTitleRank ?? previous?.currentRank ?? lookup.currentRank,
        delta,
        deltaStatus,
        searchPage: lookup.searchPage,
        foundTitle: lookup.foundTitle,
        foundProductRef: lookup.foundProductRef
      }
    });

    await prisma.rankTrackingJob.update({
      where: { id: job.id },
      data: {
        lastRunAt: now,
        nextRunAt: getNextRunAt(job.interval),
        retryCount: 0,
        status: "RUNNING"
      }
    });

    return result;
  } catch (error) {
    if (!job) {
      await writeSystemLog({
        level: "ERROR",
        scope: "rank-job.run",
        message: "Rank tracking job lookup failed",
        meta: {
          jobId,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }

    const retryCount = job.retryCount + 1;

    await prisma.rankTrackingJob.update({
      where: { id: job.id },
      data: {
        retryCount,
        nextRunAt: getNextRunAt(job.interval),
        status: retryCount >= 3 ? "FAILED" : "RUNNING"
      }
    });

    await writeSystemLog({
      level: "ERROR",
      scope: "rank-job.run",
      message: "Rank tracking job failed",
      meta: {
        jobId: job.id,
        retryCount,
        error: error instanceof Error ? error.message : String(error)
      }
    });

    throw error;
  } finally {
    runningJobIds.delete(jobId);
  }
}
