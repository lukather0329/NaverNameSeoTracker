import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.upsert({
    where: { smartStoreProductId: "SS-10001" },
    update: {
      currentTitle: "Naver SEO Test Premium Tumbler 900ml",
      seoOptimizedTitle: "Naver SEO Test Premium Tumbler 900ml Large Capacity Insulated Bottle",
      primaryKeyword: "insulated tumbler",
      trackingKeywords: "insulated tumbler,large tumbler,stainless tumbler",
      testStatus: "RUNNING"
    },
    create: {
      smartStoreProductId: "SS-10001",
      originProductId: "ORG-90001",
      channelProductId: "CH-10001",
      sellerManagementCode: "SELLER-SEO-01",
      currentTitle: "Naver SEO Test Premium Tumbler 900ml",
      originalTitle: "Premium Tumbler 900ml",
      seoOptimizedTitle: "Naver SEO Test Premium Tumbler 900ml Large Capacity Insulated Bottle",
      primaryKeyword: "insulated tumbler",
      trackingKeywords: "insulated tumbler,large tumbler,stainless tumbler",
      category: "Kitchen",
      price: 25900,
      productStatus: "ON_SALE",
      testStatus: "RUNNING"
    }
  });

  await prisma.apiAccount.upsert({
    where: { id: "seed-api-account-1" },
    update: {
      connectionStatus: "CONNECTED"
    },
    create: {
      id: "seed-api-account-1",
      name: "Main Smartstore Account",
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

  await prisma.seoTitleCandidate.deleteMany({ where: { productId: product.id } });
  await prisma.titleChangeLog.deleteMany({ where: { productId: product.id } });
  await prisma.rankTrackingResult.deleteMany({ where: { productId: product.id } });
  await prisma.rankTrackingJob.deleteMany({ where: { productId: product.id } });
  await prisma.experimentKeyword.deleteMany({ where: { experiment: { productId: product.id } } });
  await prisma.seoExperiment.deleteMany({ where: { productId: product.id } });

  await prisma.seoTitleCandidate.create({
    data: {
      productId: product.id,
      source: "MVP_ADAPTER",
      title: "Naver SEO Test Premium Tumbler 900ml Large Capacity Insulated Bottle",
      notes: "Seeded sample title candidate"
    }
  });

  await prisma.titleChangeLog.create({
    data: {
      productId: product.id,
      beforeTitle: "Premium Tumbler 900ml",
      afterTitle: "Naver SEO Test Premium Tumbler 900ml Large Capacity Insulated Bottle",
      appliedAt: new Date(),
      mode: "VALIDATION",
      result: "SUCCESS"
    }
  });

  const experiment = await prisma.seoExperiment.create({
    data: {
      name: "Tumbler SEO Test Round 1",
      productId: product.id,
      beforeTitle: "Premium Tumbler 900ml",
      afterTitle: "Naver SEO Test Premium Tumbler 900ml Large Capacity Insulated Bottle",
      appliedAt: new Date(),
      trackingInterval: "30",
      startDate: new Date(),
      status: "RUNNING",
      summary: "Initial seeded experiment",
      judgement: "PENDING",
      minObservationHours: 24,
      notes: "No price change / No ads running"
    }
  });

  await prisma.experimentKeyword.createMany({
    data: [
      { experimentId: experiment.id, keyword: "insulated tumbler", isPrimary: true },
      { experimentId: experiment.id, keyword: "large tumbler", isPrimary: false },
      { experimentId: experiment.id, keyword: "stainless tumbler", isPrimary: false }
    ]
  });

  const job = await prisma.rankTrackingJob.create({
    data: {
      experimentId: experiment.id,
      productId: product.id,
      keyword: "insulated tumbler",
      interval: "30",
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
      keyword: "insulated tumbler",
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
