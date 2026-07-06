import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.upsert({
    where: { smartStoreProductId: "SS-10001" },
    update: {},
    create: {
      smartStoreProductId: "SS-10001",
      originProductId: "ORG-90001",
      channelProductId: "CH-10001",
      sellerManagementCode: "SELLER-SEO-01",
      currentTitle: "네이버 SEO 테스트용 프리미엄 텀블러 900ml",
      originalTitle: "프리미엄 텀블러 900ml",
      seoOptimizedTitle: "네이버 SEO 테스트용 프리미엄 텀블러 900ml 대용량 보온 보냉",
      primaryKeyword: "대용량 텀블러",
      trackingKeywords: "대용량 텀블러,보온 텀블러,사무실 텀블러",
      category: "주방용품",
      price: 25900,
      productStatus: "ON_SALE",
      testStatus: "RUNNING"
    }
  });

  await prisma.apiAccount.upsert({
    where: { id: "seed-api-account-1" },
    update: {},
    create: {
      id: "seed-api-account-1",
      name: "메인 스마트스토어 계정",
      type: "COMMERCE",
      clientId: "naver-client-id-1234",
      clientSecret: "naver-client-secret-1234",
      accessLicense: "license-1234",
      secretKey: "secret-key-1234",
      customerId: "100001",
      storeId: "smartstore-main",
      channelId: "channel-main",
      connectionStatus: "CONNECTED"
    }
  });

  await prisma.seoTitleCandidate.create({
    data: {
      productId: product.id,
      source: "MVP_ADAPTER",
      title: "네이버 SEO 테스트용 프리미엄 텀블러 900ml 대용량 보온 보냉",
      notes: "기존 MVP 생성안"
    }
  });

  await prisma.titleChangeLog.create({
    data: {
      productId: product.id,
      beforeTitle: "프리미엄 텀블러 900ml",
      afterTitle: "네이버 SEO 테스트용 프리미엄 텀블러 900ml 대용량 보온 보냉",
      appliedAt: new Date(),
      mode: "VALIDATION",
      result: "SUCCESS"
    }
  });

  const experiment = await prisma.seoExperiment.create({
    data: {
      name: "텀블러 상품명 SEO 검증 1차",
      productId: product.id,
      beforeTitle: "프리미엄 텀블러 900ml",
      afterTitle: "네이버 SEO 테스트용 프리미엄 텀블러 900ml 대용량 보온 보냉",
      appliedAt: new Date(),
      trackingInterval: "30_MINUTES",
      startDate: new Date(),
      status: "RUNNING",
      summary: "초기 실험 진행 중",
      judgement: "PENDING",
      minObservationHours: 24,
      notes: "광고 집행 없음 / 가격 변동 없음"
    }
  });

  await prisma.experimentKeyword.createMany({
    data: [
      { experimentId: experiment.id, keyword: "대용량 텀블러", isPrimary: true },
      { experimentId: experiment.id, keyword: "보온 텀블러", isPrimary: false },
      { experimentId: experiment.id, keyword: "사무실 텀블러", isPrimary: false }
    ]
  });

  const job = await prisma.rankTrackingJob.create({
    data: {
      experimentId: experiment.id,
      productId: product.id,
      keyword: "대용량 텀블러",
      interval: "30_MINUTES",
      provider: "MOCK",
      isEnabled: true,
      status: "RUNNING"
    }
  });

  await prisma.rankTrackingResult.create({
    data: {
      jobId: job.id,
      experimentId: experiment.id,
      productId: product.id,
      keyword: "대용량 텀블러",
      trackedAt: new Date(),
      currentRank: 7,
      previousRank: 11,
      initialRank: 11,
      beforeTitleRank: 11,
      delta: 4,
      deltaStatus: "UP",
      searchPage: 1,
      foundTitle: product.currentTitle,
      foundProductRef: "mock://SS-10001"
    }
  });

  await prisma.systemLog.create({
    data: {
      level: "INFO",
      scope: "seed",
      message: "Initial sample data seeded"
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
