import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { maskSecret } from "../lib/mask.js";
import { decryptSecret, encryptSecret } from "../lib/secrets.js";
import { getDashboardSummary } from "../services/dashboard-service.js";
import { runTrackingJob } from "../services/rank-tracking-service.js";
import { writeSystemLog } from "../services/system-log-service.js";

const router = Router();

const apiAccountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["COMMERCE", "SEARCH_AD", "CUSTOM"]),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  accessLicense: z.string().optional(),
  secretKey: z.string().optional(),
  customerId: z.string().optional(),
  storeId: z.string().optional(),
  channelId: z.string().optional(),
  isActive: z.boolean().default(true)
});

const apiAccountUpdateSchema = apiAccountSchema.partial().extend({
  name: z.string().min(1).optional(),
  type: z.enum(["COMMERCE", "SEARCH_AD", "CUSTOM"]).optional()
});

const productSchema = z.object({
  smartStoreProductId: z.string().min(1),
  originProductId: z.string().optional(),
  channelProductId: z.string().optional(),
  sellerManagementCode: z.string().optional(),
  currentTitle: z.string().min(1),
  originalTitle: z.string().optional(),
  seoOptimizedTitle: z.string().optional(),
  primaryKeyword: z.string().optional(),
  trackingKeywords: z.array(z.string()).default([]),
  category: z.string().optional(),
  price: z.number().int().nonnegative(),
  productStatus: z.enum(["ON_SALE", "PAUSED", "SOLD_OUT"]).default("ON_SALE"),
  testStatus: z.enum(["DRAFT", "RUNNING", "PAUSED", "COMPLETED", "FAILED"]).default("DRAFT")
});

const experimentSchema = z.object({
  name: z.string().min(1),
  productId: z.string().min(1),
  beforeTitle: z.string().min(1),
  afterTitle: z.string().min(1),
  trackingKeywords: z.array(z.string().min(1)).default([]),
  trackingInterval: z.enum(["30_MINUTES", "60_MINUTES"]),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  minObservationHours: z.number().int().positive().default(24),
  notes: z.string().optional()
});

const experimentActionSchema = z.object({
  reason: z.string().optional()
});

const titleApplySchema = z.object({
  afterTitle: z.string().min(1),
  mode: z.enum(["VALIDATION", "LIVE"]).default("VALIDATION"),
  confirmed: z.literal(true),
  reason: z.string().optional()
});

const titleRollbackSchema = z.object({
  confirmed: z.literal(true),
  reason: z.string().optional()
});

const titleCandidateSchema = z.object({
  productId: z.string().min(1),
  source: z.enum(["MANUAL", "CSV", "MVP_ADAPTER"]),
  title: z.string().min(1),
  notes: z.string().optional()
});

type ApiAccountRecord = Awaited<ReturnType<typeof prisma.apiAccount.findMany>>[number];
type SeoExperimentRecord = Awaited<ReturnType<typeof prisma.seoExperiment.findMany>>[number] & {
  keywords?: Array<{ keyword: string; isPrimary: boolean }>;
};

function serializeApiAccount(item: ApiAccountRecord) {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    clientIdMasked: maskSecret(decryptSecret(item.clientId)),
    clientSecretMasked: maskSecret(decryptSecret(item.clientSecret)),
    accessLicenseMasked: maskSecret(decryptSecret(item.accessLicense)),
    secretKeyMasked: maskSecret(decryptSecret(item.secretKey)),
    customerId: item.customerId,
    storeId: item.storeId,
    channelId: item.channelId,
    isActive: item.isActive,
    lastCheckedAt: item.lastCheckedAt,
    connectionStatus: item.connectionStatus,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function prepareApiAccountSecrets<T extends Partial<z.infer<typeof apiAccountSchema>>>(input: T) {
  return {
    ...input,
    clientId: input.clientId === undefined ? undefined : encryptSecret(input.clientId),
    clientSecret: input.clientSecret === undefined ? undefined : encryptSecret(input.clientSecret),
    accessLicense: input.accessLicense === undefined ? undefined : encryptSecret(input.accessLicense),
    secretKey: input.secretKey === undefined ? undefined : encryptSecret(input.secretKey)
  };
}

function serializeExperiment(item: SeoExperimentRecord) {
  return {
    ...item,
    trackingKeywords: item.keywords?.map((keyword) => keyword.keyword) ?? []
  };
}

function normalizeKeywords(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function getNextRunAt(interval: "30_MINUTES" | "60_MINUTES") {
  const minutes = interval === "30_MINUTES" ? 30 : 60;
  return new Date(Date.now() + minutes * 60 * 1000);
}

router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "naver-name-seo-tracker-api" });
});

router.get("/snapshot", async (_req, res) => {
  const [dashboard, apiAccounts, products, seoTitleCandidates, titleChangeLogs, experiments, jobs, results] =
    await Promise.all([
      getDashboardSummary(),
      prisma.apiAccount.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.product.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.seoTitleCandidate.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.titleChangeLog.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.seoExperiment.findMany({
        orderBy: { createdAt: "desc" },
        include: { keywords: { orderBy: { createdAt: "asc" } } }
      }),
      prisma.rankTrackingJob.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.rankTrackingResult.findMany({ orderBy: { trackedAt: "desc" }, take: 100 })
    ]);

  res.json({
    dashboard,
    apiAccounts: apiAccounts.map(serializeApiAccount),
    products: products.map((item) => ({
      ...item,
      trackingKeywords: item.trackingKeywords.split(",").filter(Boolean)
    })),
    seoTitleCandidates,
    titleChangeLogs,
    experiments: experiments.map(serializeExperiment),
    jobs,
    results
  });
});

router.post("/accounts", async (req, res) => {
  const input = apiAccountSchema.parse(req.body);
  const account = await prisma.apiAccount.create({
    data: {
      ...prepareApiAccountSecrets(input),
      connectionStatus: "UNVERIFIED"
    }
  });

  res.status(201).json(serializeApiAccount(account));
});

router.put("/accounts/:id", async (req, res) => {
  const input = apiAccountUpdateSchema.parse(req.body);
  const account = await prisma.apiAccount.update({
    where: { id: req.params.id },
    data: prepareApiAccountSecrets(input)
  });

  res.json(serializeApiAccount(account));
});

router.post("/accounts/:id/test", async (req, res) => {
  const account = await prisma.apiAccount.findUnique({
    where: { id: req.params.id }
  });

  if (!account) {
    res.status(404).json({ ok: false, message: "Account not found" });
    return;
  }

  const clientId = decryptSecret(account.clientId);
  const clientSecret = decryptSecret(account.clientSecret);
  const accessLicense = decryptSecret(account.accessLicense);
  const secretKey = decryptSecret(account.secretKey);

  const hasBaseCredentials = Boolean(clientId && clientSecret);
  const hasExtendedCredentials =
    account.type !== "COMMERCE" ||
    Boolean(accessLicense && secretKey && (account.storeId || account.channelId));

  const isConnected = hasBaseCredentials && hasExtendedCredentials;
  const connectionStatus = isConnected ? "CONNECTED" : "FAILED";

  const updated = await prisma.apiAccount.update({
    where: { id: account.id },
    data: {
      connectionStatus,
      lastCheckedAt: new Date()
    }
  });

  if (!isConnected) {
    await writeSystemLog({
      level: "WARN",
      scope: "api-account.connection-test",
      message: "API account connection test failed before live request",
      meta: {
        accountId: account.id,
        type: account.type,
        hasBaseCredentials,
        hasExtendedCredentials
      }
    });
  }

  res.json({
    ok: isConnected,
    message: isConnected
      ? "연결 테스트에 성공했습니다."
      : "필수 인증 정보가 부족해 연결 테스트에 실패했습니다.",
    account: serializeApiAccount(updated)
  });
});

router.post("/products", async (req, res) => {
  const input = productSchema.parse(req.body);
  const product = await prisma.product.create({
    data: {
      ...input,
      trackingKeywords: input.trackingKeywords.join(",")
    }
  });

  res.status(201).json(product);
});

router.post("/title-candidates", async (req, res) => {
  const input = titleCandidateSchema.parse(req.body);
  const candidate = await prisma.seoTitleCandidate.create({
    data: input
  });

  res.status(201).json(candidate);
});

router.post("/experiments", async (req, res) => {
  const input = experimentSchema.parse(req.body);
  const product = await prisma.product.findUnique({
    where: { id: input.productId }
  });

  if (!product) {
    res.status(404).json({ ok: false, message: "Product not found" });
    return;
  }

  const keywords = normalizeKeywords(
    input.trackingKeywords.length ? input.trackingKeywords : product.trackingKeywords.split(",")
  );

  if (!keywords.length) {
    res.status(400).json({ ok: false, message: "At least one tracking keyword is required" });
    return;
  }

  const experiment = await prisma.$transaction(async (tx) => {
    const created = await tx.seoExperiment.create({
      data: {
        name: input.name,
        productId: input.productId,
        beforeTitle: input.beforeTitle,
        afterTitle: input.afterTitle,
        trackingInterval: input.trackingInterval,
        startDate: new Date(input.startDate),
        endDate: input.endDate ? new Date(input.endDate) : null,
        minObservationHours: input.minObservationHours,
        notes: input.notes,
        status: "DRAFT",
        judgement: "PENDING",
        keywords: {
          create: keywords.map((keyword, index) => ({
            keyword,
            isPrimary: index === 0
          }))
        },
        rankJobs: {
          create: keywords.map((keyword) => ({
            productId: input.productId,
            keyword,
            interval: input.trackingInterval,
            provider: "MOCK",
            isEnabled: false,
            nextRunAt: getNextRunAt(input.trackingInterval),
            status: "DRAFT"
          }))
        }
      },
      include: { keywords: { orderBy: { createdAt: "asc" } } }
    });

    await tx.systemLog.create({
      data: {
        level: "INFO",
        scope: "experiment.create",
        message: "Experiment created with tracking keywords and draft jobs",
        metaJson: JSON.stringify({ experimentId: created.id, keywordCount: keywords.length })
      }
    });

    return created;
  });

  res.status(201).json(serializeExperiment(experiment));
});

router.post("/experiments/:id/start", async (req, res) => {
  const input = experimentActionSchema.parse(req.body);
  const experiment = await prisma.seoExperiment.update({
    where: { id: req.params.id },
    data: {
      status: "RUNNING",
      rankJobs: {
        updateMany: {
          where: {},
          data: {
            isEnabled: true,
            status: "RUNNING"
          }
        }
      }
    },
    include: { keywords: { orderBy: { createdAt: "asc" } } }
  });

  await writeSystemLog({
    level: "INFO",
    scope: "experiment.start",
    message: "Experiment started",
    meta: { experimentId: experiment.id, reason: input.reason }
  });

  res.json(serializeExperiment(experiment));
});

router.post("/experiments/:id/pause", async (req, res) => {
  const input = experimentActionSchema.parse(req.body);
  const experiment = await prisma.seoExperiment.update({
    where: { id: req.params.id },
    data: {
      status: "PAUSED",
      rankJobs: {
        updateMany: {
          where: {},
          data: {
            isEnabled: false,
            status: "PAUSED"
          }
        }
      }
    },
    include: { keywords: { orderBy: { createdAt: "asc" } } }
  });

  await writeSystemLog({
    level: "INFO",
    scope: "experiment.pause",
    message: "Experiment paused",
    meta: { experimentId: experiment.id, reason: input.reason }
  });

  res.json(serializeExperiment(experiment));
});

router.post("/experiments/:id/complete", async (req, res) => {
  const input = experimentActionSchema.parse(req.body);
  const experiment = await prisma.seoExperiment.update({
    where: { id: req.params.id },
    data: {
      status: "COMPLETED",
      endDate: new Date(),
      rankJobs: {
        updateMany: {
          where: {},
          data: {
            isEnabled: false,
            status: "COMPLETED"
          }
        }
      }
    },
    include: { keywords: { orderBy: { createdAt: "asc" } } }
  });

  await writeSystemLog({
    level: "INFO",
    scope: "experiment.complete",
    message: "Experiment completed",
    meta: { experimentId: experiment.id, reason: input.reason }
  });

  res.json(serializeExperiment(experiment));
});

router.post("/products/:id/title/apply", async (req, res) => {
  const input = titleApplySchema.parse(req.body);
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });

  if (!product) {
    res.status(404).json({ ok: false, message: "Product not found" });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedProduct = await tx.product.update({
      where: { id: product.id },
      data: {
        currentTitle: input.afterTitle,
        seoOptimizedTitle: input.afterTitle,
        testStatus: "RUNNING"
      }
    });

    const log = await tx.titleChangeLog.create({
      data: {
        productId: product.id,
        beforeTitle: product.currentTitle,
        afterTitle: input.afterTitle,
        appliedAt: new Date(),
        mode: input.mode,
        result: "SUCCESS",
        reason: input.reason
      }
    });

    await tx.systemLog.create({
      data: {
        level: "INFO",
        scope: "product-title.apply",
        message: "Product title applied",
        metaJson: JSON.stringify({ productId: product.id, titleChangeLogId: log.id, mode: input.mode })
      }
    });

    return { product: updatedProduct, titleChangeLog: log };
  });

  res.json({ ok: true, ...result });
});

router.post("/products/:id/title/rollback", async (req, res) => {
  const input = titleRollbackSchema.parse(req.body);
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });

  if (!product) {
    res.status(404).json({ ok: false, message: "Product not found" });
    return;
  }

  const latestAppliedLog = await prisma.titleChangeLog.findFirst({
    where: {
      productId: product.id,
      result: "SUCCESS"
    },
    orderBy: { appliedAt: "desc" }
  });

  if (!latestAppliedLog) {
    res.status(400).json({ ok: false, message: "No successful title change to roll back" });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedProduct = await tx.product.update({
      where: { id: product.id },
      data: {
        currentTitle: latestAppliedLog.beforeTitle,
        seoOptimizedTitle: latestAppliedLog.beforeTitle,
        testStatus: "PAUSED"
      }
    });

    const log = await tx.titleChangeLog.create({
      data: {
        productId: product.id,
        beforeTitle: product.currentTitle,
        afterTitle: latestAppliedLog.beforeTitle,
        appliedAt: new Date(),
        mode: latestAppliedLog.mode,
        result: "ROLLED_BACK",
        reason: input.reason ?? `Rollback of ${latestAppliedLog.id}`
      }
    });

    await tx.systemLog.create({
      data: {
        level: "WARN",
        scope: "product-title.rollback",
        message: "Product title rolled back",
        metaJson: JSON.stringify({
          productId: product.id,
          rolledBackTitleChangeLogId: latestAppliedLog.id,
          titleChangeLogId: log.id
        })
      }
    });

    return { product: updatedProduct, titleChangeLog: log };
  });

  res.json({ ok: true, ...result });
});

router.post("/jobs/:id/run", async (req, res) => {
  const result = await runTrackingJob(req.params.id, { force: true });
  res.json({ ok: true, result });
});

export { router };
