import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { maskSecret } from "../lib/mask.js";
import { getDashboardSummary } from "../services/dashboard-service.js";
import { runDecisionProjection } from "../services/decision-engine-service.js";
import { testNaverApiConnection } from "../services/naver-api-test-service.js";
import { importProductsFromCommerceAccount } from "../services/naver-commerce-product-import-service.js";
import { runTrackingJob } from "../services/rank-tracking-service.js";

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

const productImportSchema = z.object({
  apiAccountId: z.string().min(1).optional()
});

const productUpdateSchema = z.object({
  seoOptimizedTitle: z.string().trim().optional(),
  primaryKeyword: z.string().trim().optional(),
  trackingKeywords: z.array(z.string().trim()).optional()
});

const productDecisionProjectionSchema = z.object({
  seoTitle: z.string().trim().optional(),
  primaryKeyword: z.string().trim().optional(),
  trackingKeywords: z.array(z.string().trim()).optional(),
  targetRank: z.number().int().positive().max(500).optional(),
  iterations: z.number().int().positive().max(100000).optional(),
  seed: z.number().int().optional(),
  horizonDays: z.number().int().positive().max(365).optional()
});

const experimentSchema = z.object({
  name: z.string().min(1),
  productId: z.string().min(1),
  beforeTitle: z.string().min(1),
  afterTitle: z.string().min(1),
  trackingInterval: z.enum(["30_MINUTES", "60_MINUTES"]),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  minObservationHours: z.number().int().positive().default(24),
  notes: z.string().optional()
});

const titleCandidateSchema = z.object({
  productId: z.string().min(1),
  source: z.enum(["MANUAL", "CSV", "MVP_ADAPTER"]),
  title: z.string().min(1),
  notes: z.string().optional()
});

router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "naver-name-seo-tracker-api" });
});

router.get("/snapshot", async (_req, res) => {
  const [dashboard, apiAccounts, products, seoTitleCandidates, titleChangeLogs, experiments, jobs, results, systemLogs] =
    await Promise.all([
      getDashboardSummary(),
      prisma.apiAccount.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.product.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.seoTitleCandidate.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.titleChangeLog.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.seoExperiment.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.rankTrackingJob.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.rankTrackingResult.findMany({ orderBy: { trackedAt: "desc" }, take: 100 }),
      prisma.systemLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 })
    ]);

  const latestAccountTestLogByAccountId = new Map(
    systemLogs
      .filter((item) => item.scope === "api-account-test")
      .map((item) => {
        try {
          const meta = JSON.parse(item.metaJson ?? "{}") as {
            accountId?: string | null;
            mode?: string | null;
            statusCode?: number | null;
            details?: string | null;
          };

          return [
            meta.accountId ?? "",
            [meta.mode ? `mode=${meta.mode}` : "", typeof meta.statusCode === "number" ? `status=${meta.statusCode}` : "", meta.details ?? ""]
              .filter(Boolean)
              .join(" | ")
          ] as const;
        } catch {
          return ["", ""] as const;
        }
      })
      .filter((entry) => entry[0])
  );

  res.json({
    dashboard,
    apiAccounts: apiAccounts.map((item: (typeof apiAccounts)[number]) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      clientIdMasked: maskSecret(item.clientId),
      clientSecretMasked: maskSecret(item.clientSecret),
      accessLicenseMasked: maskSecret(item.accessLicense),
      secretKeyMasked: maskSecret(item.secretKey),
      customerId: item.customerId,
      storeId: item.storeId,
      channelId: item.channelId,
      isActive: item.isActive,
      lastCheckedAt: item.lastCheckedAt,
      connectionStatus: item.connectionStatus,
      lastTestSummary: latestAccountTestLogByAccountId.get(item.id) ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    })),
    products: products.map((item: (typeof products)[number]) => ({
      ...item,
      trackingKeywords: item.trackingKeywords.split(",").filter(Boolean)
    })),
    seoTitleCandidates,
    titleChangeLogs,
    experiments,
    jobs,
    results,
    systemLogs
  });
});

router.post("/accounts", async (req, res) => {
  const input = apiAccountSchema.parse(req.body);
  const account = await prisma.apiAccount.create({
    data: {
      ...input,
      connectionStatus: "UNVERIFIED"
    }
  });

  res.status(201).json(account);
});

router.put("/accounts/:id", async (req, res) => {
  const input = apiAccountUpdateSchema.parse(req.body);
  const sanitizedInput = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== "")
  );

  const account = await prisma.apiAccount.update({
    where: { id: req.params.id },
    data: sanitizedInput
  });

  res.json(account);
});
router.post("/accounts/:id/test", async (req, res) => {
  const account = await prisma.apiAccount.findUnique({
    where: { id: req.params.id }
  });

  if (!account) {
    res.status(404).json({ ok: false, message: "Account not found" });
    return;
  }

  const result = await testNaverApiConnection(account);
  const connectionStatus = result.ok ? "CONNECTED" : "FAILED";

  const updated = await prisma.apiAccount.update({
    where: { id: account.id },
    data: {
      connectionStatus,
      lastCheckedAt: new Date()
    }
  });

  await prisma.systemLog.create({
    data: {
      level: result.ok ? "INFO" : "ERROR",
      scope: "api-account-test",
      message: `${account.name} (${account.type}) connection test ${result.ok ? "succeeded" : "failed"}`,
      metaJson: JSON.stringify({
        accountId: account.id,
        accountType: account.type,
        mode: result.mode,
        statusCode: result.statusCode ?? null,
        details: result.details ?? null
      })
    }
  });

  res.json({
    ok: result.ok,
    mode: result.mode,
    statusCode: result.statusCode,
    details: result.details,
    message: result.message,
    account: updated
  });
});

router.post("/products/import/naver-commerce", async (req, res) => {
  const input = productImportSchema.parse(req.body ?? {});
  const account = input.apiAccountId
    ? await prisma.apiAccount.findUnique({ where: { id: input.apiAccountId } })
    : await prisma.apiAccount.findFirst({
        where: {
          type: "COMMERCE",
          isActive: true
        },
        orderBy: { updatedAt: "desc" }
      });

  if (!account) {
    res.status(404).json({ ok: false, message: "활성 COMMERCE API 계정을 먼저 등록해 주세요." });
    return;
  }

  try {
    const result = await importProductsFromCommerceAccount(account);
    res.json({
      ok: true,
      message: `${result.accountName} 계정에서 스마트스토어 상품 ${result.importedCount}개를 동기화했습니다.`,
      ...result
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "스마트스토어 상품 동기화 중 알 수 없는 오류가 발생했습니다.";

    await prisma.systemLog.create({
      data: {
        level: "ERROR",
        scope: "product-import",
        message: `${account.name} 계정 스마트스토어 상품 동기화 실패`,
        metaJson: JSON.stringify({
          accountId: account.id,
          details: message
        })
      }
    });

    res.status(502).json({ ok: false, message });
  }
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

router.put("/products/:id", async (req, res) => {
  const input = productUpdateSchema.parse(req.body ?? {});
  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: {
      seoOptimizedTitle: input.seoOptimizedTitle,
      primaryKeyword: input.primaryKeyword,
      trackingKeywords: input.trackingKeywords ? input.trackingKeywords.filter(Boolean).join(",") : undefined
    }
  });

  res.json({
    ...product,
    trackingKeywords: product.trackingKeywords.split(",").filter(Boolean)
  });
});

router.post("/products/:id/decision-projection", async (req, res) => {
  const input = productDecisionProjectionSchema.parse(req.body ?? {});
  const productRecord = await prisma.product.findUnique({ where: { id: req.params.id } });

  if (!productRecord) {
    res.status(404).json({ ok: false, message: "상품을 찾을 수 없습니다." });
    return;
  }

  const history = await prisma.rankTrackingResult.findMany({
    where: { productId: productRecord.id },
    orderBy: { trackedAt: "desc" },
    take: 30
  });

  const product = {
    ...productRecord,
    trackingKeywords: productRecord.trackingKeywords.split(",").filter(Boolean)
  };

  try {
    const projection = await runDecisionProjection({ product, history, input });
    res.json(projection);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "의사결정 엔진 분석에 실패했습니다.";

    await prisma.systemLog.create({
      data: {
        level: "ERROR",
        scope: "decision-engine",
        message: `${productRecord.currentTitle} decision projection failed`,
        metaJson: JSON.stringify({
          productId: productRecord.id,
          details: message
        })
      }
    });

    res.status(502).json({ ok: false, message });
  }
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
  const experiment = await prisma.seoExperiment.create({
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
      judgement: "PENDING"
    }
  });

  res.status(201).json(experiment);
});

router.post("/jobs/:id/run", async (req, res) => {
  const result = await runTrackingJob(req.params.id);
  res.json({ ok: true, result });
});

export { router };

