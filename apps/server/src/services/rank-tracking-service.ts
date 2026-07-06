import { prisma } from "../lib/prisma.js";
import { MockRankProvider } from "../providers/mock-rank-provider.js";
import { NaverShoppingRankProvider } from "../providers/naver-shopping-rank-provider.js";
import type { RankProvider } from "../providers/rank-provider.js";

function resolveProvider(provider: string): RankProvider {
  if (provider === "NAVER_SHOPPING") {
    return new NaverShoppingRankProvider();
  }

  return new MockRankProvider();
}

export async function runTrackingJob(jobId: string) {
  const job = await prisma.rankTrackingJob.findUnique({
    where: { id: jobId },
    include: {
      product: true
    }
  });

  if (!job || !job.isEnabled) {
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
      trackedAt: new Date(),
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
      lastRunAt: new Date(),
      status: "RUNNING"
    }
  });

  return result;
}
