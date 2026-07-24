import { decryptSecret } from "../lib/crypto.js";
import { prisma } from "../lib/prisma.js";
import { MockRankProvider } from "../providers/mock-rank-provider.js";
import { NaverShoppingRankProvider } from "../providers/naver-shopping-rank-provider.js";
import type { RankProvider } from "../providers/rank-provider.js";

// 활성화된 쇼핑검색(오픈API) 계정을 찾아 자격증명을 복호화해서 돌려준다.
// 계정이 여러 개면 가장 최근에 등록된 것을 사용한다 — 계정별로 실험을 나눠 쓰는
// 구조가 아니라, 스토어 하나당 쇼핑검색 오픈API 앱은 보통 하나면 충분하기 때문이다.
export async function findActiveShoppingSearchCredentials(): Promise<{ clientId: string; clientSecret: string } | null> {
  const account = await prisma.apiAccount.findFirst({
    where: { type: "SHOPPING_SEARCH", isActive: true },
    orderBy: { createdAt: "desc" }
  });

  if (!account) {
    return null;
  }

  const clientId = account.clientId.trim();
  const clientSecret = decryptSecret(account.clientSecret) ?? "";

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
}

async function resolveProvider(provider: string): Promise<RankProvider> {
  if (provider === "NAVER_SHOPPING") {
    const credentials = await findActiveShoppingSearchCredentials();

    if (!credentials) {
      throw new Error(
        "네이버 오픈API 쇼핑검색 계정이 없거나 비활성 상태입니다. API 계정 관리에서 쇼핑검색 계정을 등록/활성화하세요."
      );
    }

    return new NaverShoppingRankProvider(credentials.clientId, credentials.clientSecret);
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

  const provider = await resolveProvider(job.provider);
  const lookup = await provider.lookup({
    keyword: job.keyword,
    productId: job.productId,
    currentTitle: job.product.currentTitle,
    smartStoreProductId: job.product.smartStoreProductId,
    originProductId: job.product.originProductId
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
