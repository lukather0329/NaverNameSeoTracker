import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { maskSecret } from "../lib/mask.js";
import { decryptSecret, encryptSecret } from "../lib/crypto.js";
import { getDashboardSummary } from "../services/dashboard-service.js";
import { runDecisionProjection } from "../services/decision-engine-service.js";
import { testNaverApiConnection } from "../services/naver-api-test-service.js";
import { importProductsFromCommerceAccount } from "../services/naver-commerce-product-import-service.js";
import { publishProductTitleToNaver } from "../services/naver-product-publish-service.js";
import { findActiveShoppingSearchCredentials, runTrackingJob } from "../services/rank-tracking-service.js";

const router = Router();

const apiAccountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["COMMERCE", "SEARCH_AD", "SHOPPING_SEARCH", "CUSTOM"]),
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
  type: z.enum(["COMMERCE", "SEARCH_AD", "SHOPPING_SEARCH", "CUSTOM"]).optional()
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
  apiAccountId: z.string().min(1).optional(),
  forceResync: z.boolean().optional()
});

const productBulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1)
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
  trackingInterval: z.string().regex(/^\d+$/, "추적 주기는 분 단위 숫자로 입력해주세요."),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  minObservationHours: z.number().int().positive().default(24),
  notes: z.string().optional(),
  // 실험을 실제로 "시작"할 때 순위 추적 작업을 만들 키워드가 있어야 한다.
  // 초안 생성 시점에 상품의 대표/추적 키워드를 함께 받아 ExperimentKeyword로 저장해 둔다.
  primaryKeyword: z.string().optional(),
  trackingKeywords: z.array(z.string()).optional()
});

const experimentUpdateSchema = z.object({
  trackingInterval: z.string().regex(/^\d+$/, "추적 주기는 분 단위 숫자로 입력해주세요.").optional(),
  minObservationHours: z.number().int().positive().optional(),
  notes: z.string().optional(),
  status: z.enum(["DRAFT", "RUNNING", "PAUSED", "COMPLETED", "FAILED"]).optional(),
  endDate: z.string().datetime().optional()
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
  const [dashboard, apiAccounts, products, seoTitleCandidates, titleChangeLogs, experiments, jobs, results, systemLogs, excludedProducts] =
    await Promise.all([
      getDashboardSummary(),
      prisma.apiAccount.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.product.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.seoTitleCandidate.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.titleChangeLog.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.seoExperiment.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.rankTrackingJob.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.rankTrackingResult.findMany({ orderBy: { trackedAt: "desc" }, take: 100 }),
      prisma.systemLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.excludedProduct.findMany({ orderBy: { createdAt: "desc" } })
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
      clientSecretMasked: maskSecret(decryptSecret(item.clientSecret)),
      accessLicenseMasked: maskSecret(decryptSecret(item.accessLicense)),
      secretKeyMasked: maskSecret(decryptSecret(item.secretKey)),
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
    systemLogs,
    excludedProducts
  });
});

router.post("/accounts", async (req, res) => {
  const input = apiAccountSchema.parse(req.body);
  const account = await prisma.apiAccount.create({
    data: {
      ...input,
      clientSecret: encryptSecret(input.clientSecret) ?? input.clientSecret,
      accessLicense: encryptSecret(input.accessLicense),
      secretKey: encryptSecret(input.secretKey),
      connectionStatus: "UNVERIFIED"
    }
  });

  res.status(201).json(account);
});

router.put("/accounts/:id", async (req, res) => {
  const input = apiAccountUpdateSchema.parse(req.body);
  const sanitizedInput: Record<string, unknown> = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== "")
  );

  if (typeof sanitizedInput.clientSecret === "string") {
    sanitizedInput.clientSecret = encryptSecret(sanitizedInput.clientSecret);
  }
  if (typeof sanitizedInput.accessLicense === "string") {
    sanitizedInput.accessLicense = encryptSecret(sanitizedInput.accessLicense);
  }
  if (typeof sanitizedInput.secretKey === "string") {
    sanitizedInput.secretKey = encryptSecret(sanitizedInput.secretKey);
  }

  const account = await prisma.apiAccount.update({
    where: { id: req.params.id },
    data: sanitizedInput
  });

  res.json(account);
});

router.delete("/accounts/:id", async (req, res) => {
  const account = await prisma.apiAccount.findUnique({ where: { id: req.params.id } });

  if (!account) {
    res.status(404).json({ ok: false, message: "계정을 찾을 수 없습니다." });
    return;
  }

  await prisma.apiAccount.delete({ where: { id: account.id } });

  await prisma.systemLog.create({
    data: {
      level: "INFO",
      scope: "api-account-delete",
      message: `${account.name} (${account.type}) API 계정을 삭제했습니다.`,
      metaJson: JSON.stringify({ accountId: account.id, type: account.type })
    }
  });

  res.json({ ok: true });
});

router.post("/accounts/:id/test", async (req, res) => {
  const account = await prisma.apiAccount.findUnique({
    where: { id: req.params.id }
  });

  if (!account) {
    res.status(404).json({ ok: false, message: "Account not found" });
    return;
  }

  const decryptedAccount = {
    ...account,
    clientSecret: decryptSecret(account.clientSecret) ?? account.clientSecret,
    accessLicense: decryptSecret(account.accessLicense),
    secretKey: decryptSecret(account.secretKey)
  };
  const result = await testNaverApiConnection(decryptedAccount);
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
    const decryptedAccount = {
      ...account,
      clientSecret: decryptSecret(account.clientSecret) ?? account.clientSecret
    };
    const result = await importProductsFromCommerceAccount(decryptedAccount, { forceResync: input.forceResync });
    res.json({
      ok: true,
      message: `${result.accountName} 계정에서 스마트스토어 상품 ${result.importedCount}개를 동기화했습니다.${result.forceResync ? " (강제 재동기화)" : ""}`,
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

router.delete("/products/:id", async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });

  if (!product) {
    res.status(404).json({ ok: false, message: "상품을 찾을 수 없습니다." });
    return;
  }

  await prisma.product.delete({ where: { id: req.params.id } });
  await excludeSmartStoreProductIds([product.smartStoreProductId], "단건 삭제");

  await prisma.systemLog.create({
    data: {
      level: "INFO",
      scope: "product-delete",
      message: `${product.currentTitle} 추적 상품을 목록에서 제거했습니다.`,
      metaJson: JSON.stringify({ productId: product.id, smartStoreProductId: product.smartStoreProductId })
    }
  });

  res.json({ ok: true });
});

router.post("/products/bulk-delete", async (req, res) => {
  const input = productBulkDeleteSchema.parse(req.body ?? {});
  const products = await prisma.product.findMany({ where: { id: { in: input.ids } } });

  if (products.length === 0) {
    res.status(404).json({ ok: false, message: "삭제할 상품을 찾을 수 없습니다." });
    return;
  }

  await prisma.product.deleteMany({ where: { id: { in: products.map((product) => product.id) } } });
  await excludeSmartStoreProductIds(products.map((product) => product.smartStoreProductId), "일괄 삭제");

  await prisma.systemLog.create({
    data: {
      level: "INFO",
      scope: "product-delete",
      message: `${products.length}개 상품을 일괄 삭제했습니다.`,
      metaJson: JSON.stringify({
        deletedCount: products.length,
        productIds: products.map((product) => product.id),
        smartStoreProductIds: products.map((product) => product.smartStoreProductId)
      })
    }
  });

  res.json({ ok: true, deletedCount: products.length });
});

router.delete("/excluded-products/:id", async (req, res) => {
  const entry = await prisma.excludedProduct.findUnique({ where: { id: req.params.id } });

  if (!entry) {
    res.status(404).json({ ok: false, message: "제외 목록에서 항목을 찾을 수 없습니다." });
    return;
  }

  await prisma.excludedProduct.delete({ where: { id: entry.id } });

  await prisma.systemLog.create({
    data: {
      level: "INFO",
      scope: "product-exclusion-restore",
      message: `상품 제외 목록에서 ${entry.smartStoreProductId}을(를) 복원했습니다. 다음 동기화부터 다시 불러올 수 있습니다.`,
      metaJson: JSON.stringify({ smartStoreProductId: entry.smartStoreProductId })
    }
  });

  res.json({ ok: true });
});

router.post("/products/:id/publish-title", async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });

  if (!product) {
    res.status(404).json({ ok: false, message: "상품을 찾을 수 없습니다." });
    return;
  }

  try {
    const result = await publishProductTitleToNaver(product);

    const updated = await prisma.product.update({
      where: { id: product.id },
      data: { currentTitle: result.newName }
    });

    await prisma.titleChangeLog.create({
      data: {
        productId: product.id,
        beforeTitle: result.previousName ?? product.currentTitle,
        afterTitle: result.newName,
        appliedAt: new Date(),
        mode: "REAL",
        result: "SUCCESS"
      }
    });

    await prisma.systemLog.create({
      data: {
        level: "INFO",
        scope: "product-publish",
        message: `${result.newName} 상품명을 네이버에 반영했습니다.`,
        metaJson: JSON.stringify({ productId: product.id, previousName: result.previousName, newName: result.newName })
      }
    });

    res.json({
      ok: true,
      message: "네이버 상품명을 반영했습니다.",
      previousName: result.previousName,
      newName: result.newName,
      product: { ...updated, trackingKeywords: updated.trackingKeywords.split(",").filter(Boolean) }
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "네이버 상품명 반영 중 알 수 없는 오류가 발생했습니다.";

    await prisma.titleChangeLog.create({
      data: {
        productId: product.id,
        beforeTitle: product.currentTitle,
        afterTitle: product.seoOptimizedTitle ?? product.currentTitle,
        appliedAt: new Date(),
        mode: "REAL",
        result: "FAILED",
        reason: message
      }
    });

    await prisma.systemLog.create({
      data: {
        level: "ERROR",
        scope: "product-publish",
        message: `${product.currentTitle} 상품명 네이버 반영 실패`,
        metaJson: JSON.stringify({ productId: product.id, details: message })
      }
    });

    res.status(502).json({ ok: false, message });
  }
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

  const keywordEntries = Array.from(
    new Set(
      [input.primaryKeyword, ...(input.trackingKeywords ?? [])]
        .map((keyword) => keyword?.trim())
        .filter((keyword): keyword is string => Boolean(keyword))
    )
  );

  if (keywordEntries.length > 0) {
    await prisma.experimentKeyword.createMany({
      data: keywordEntries.map((keyword, index) => ({
        experimentId: experiment.id,
        keyword,
        isPrimary: index === 0
      }))
    });
  }

  res.status(201).json(experiment);
});

// SEO 테스트 관리 화면에서 실험의 실질적인 설정(추적 주기, 최소 관찰 시간, 메모, 상태)을
// 편집·저장하기 위한 엔드포인트. 상태를 RUNNING으로 바꾸면 appliedAt을, COMPLETED로
// 바꾸면 endDate를 (아직 없을 때만) 자동으로 채워 실제 실험 진행 흐름과 맞춘다.
router.put("/experiments/:id", async (req, res) => {
  const input = experimentUpdateSchema.parse(req.body);
  const existing = await prisma.seoExperiment.findUnique({ where: { id: req.params.id } });

  if (!existing) {
    res.status(404).json({ ok: false, message: "실험을 찾을 수 없습니다." });
    return;
  }

  const data: {
    trackingInterval?: string;
    minObservationHours?: number;
    notes?: string;
    status?: string;
    endDate?: Date;
    appliedAt?: Date;
  } = {};

  if (input.trackingInterval !== undefined) {
    data.trackingInterval = input.trackingInterval;
  }
  if (input.minObservationHours !== undefined) {
    data.minObservationHours = input.minObservationHours;
  }
  if (input.notes !== undefined) {
    data.notes = input.notes;
  }
  if (input.endDate !== undefined) {
    data.endDate = new Date(input.endDate);
  }
  if (input.status !== undefined) {
    data.status = input.status;
    if (input.status === "RUNNING" && !existing.appliedAt) {
      data.appliedAt = new Date();
    }
    if (input.status === "COMPLETED" && !existing.endDate && data.endDate === undefined) {
      data.endDate = new Date();
    }
  }

  const updated = await prisma.seoExperiment.update({
    where: { id: existing.id },
    data
  });

  // 실험 상태가 바뀌면 연결된 상품의 testStatus도 같이 맞춰줘야 한다.
  // 그렇지 않으면 실험은 RUNNING인데 상품목록의 "테스트 상태" 필터(진행중 등)에는
  // 계속 DRAFT로 남아서 아무 것도 걸리지 않는 불일치가 생긴다.
  if (input.status !== undefined) {
    await prisma.product.update({
      where: { id: existing.productId },
      data: { testStatus: input.status }
    });
  }

  // 추적 주기를 바꿨는데 이미 만들어진 추적 작업(RankTrackingJob)이 있다면 그 job의
  // interval도 같이 갱신해야 한다. 그렇지 않으면 실험 설정 화면에는 "30분"으로 표시되는데
  // 실제 스케줄러는 예전 값(예: 60분) 그대로 도는 불일치가 생긴다.
  if (data.trackingInterval !== undefined) {
    await prisma.rankTrackingJob.updateMany({
      where: { experimentId: existing.id },
      data: { interval: data.trackingInterval }
    });
  }

  // 실험을 RUNNING으로 전환할 때가 "테스트가 실제로 진행되는" 시작점이다.
  // 이 시점에 실험에 연결된 키워드마다 RankTrackingJob을 만들어 두지 않으면
  // 추적 작업/결과 화면에 아무 것도 쌓이지 않아 "테스트가 진행되지 않는" 것처럼 보인다.
  // (이미 같은 키워드로 만든 job이 있으면 중복 생성하지 않고 재사용한다.)
  let createdJobCount = 0;
  let usedMockProvider = false;
  if (input.status === "RUNNING") {
    const keywords = await prisma.experimentKeyword.findMany({ where: { experimentId: existing.id } });
    // 쇼핑검색(오픈API) 계정이 활성 상태로 등록되어 있으면 실제 가격비교 순위를 조회하고,
    // 없으면 예전처럼 MOCK으로 만들되 프론트에 "실제 순위가 아님"을 알려준다.
    const shoppingSearchCredentials = await findActiveShoppingSearchCredentials();
    const jobProvider = shoppingSearchCredentials ? "NAVER_SHOPPING" : "MOCK";
    usedMockProvider = jobProvider === "MOCK";

    for (const keywordEntry of keywords) {
      const existingJob = await prisma.rankTrackingJob.findFirst({
        where: { experimentId: existing.id, keyword: keywordEntry.keyword }
      });

      if (!existingJob) {
        await prisma.rankTrackingJob.create({
          data: {
            experimentId: existing.id,
            productId: existing.productId,
            keyword: keywordEntry.keyword,
            interval: data.trackingInterval ?? existing.trackingInterval,
            provider: jobProvider,
            isEnabled: true,
            status: "RUNNING"
          }
        });
        createdJobCount += 1;
      } else if (existingJob.provider === "MOCK" && jobProvider === "NAVER_SHOPPING") {
        // 예전에 쇼핑검색 계정 없이 MOCK으로 만들어진 job이라도, 이제 쇼핑검색 계정이
        // 등록/활성화됐다면 다시 시작할 때 실제 provider로 승격시켜 준다.
        await prisma.rankTrackingJob.update({
          where: { id: existingJob.id },
          data: { provider: "NAVER_SHOPPING" }
        });
      }
    }
  }

  await prisma.systemLog.create({
    data: {
      level: "INFO",
      scope: "experiment-settings",
      message: `${updated.name} 실험 설정을 변경했습니다.${createdJobCount > 0 ? ` (추적 작업 ${createdJobCount}개 생성, ${usedMockProvider ? "MOCK" : "NAVER_SHOPPING"})` : ""}`,
      metaJson: JSON.stringify({ experimentId: updated.id, changes: input, createdJobCount, usedMockProvider })
    }
  });

  res.json({
    ...updated,
    createdJobCount,
    usedMockProvider,
    hasTrackingKeyword: (await prisma.experimentKeyword.count({ where: { experimentId: existing.id } })) > 0
  });
});

router.post("/jobs/:id/run", async (req, res) => {
  // 실제 provider(NAVER_SHOPPING)는 네트워크/인증 오류로 실패할 수 있다.
  // try/catch 없이 두면 Express 4에서는 이 예외가 처리되지 않은 프라미스 거부로
  // 남아 서버 프로세스가 죽을 수 있으므로 반드시 감싸서 에러 응답으로 변환한다.
  try {
    const result = await runTrackingJob(req.params.id);
    res.json({ ok: true, result });
  } catch (error) {
    await prisma.systemLog.create({
      data: {
        level: "ERROR",
        scope: "rank-tracking-run",
        message: "추적 작업 실행 중 오류가 발생했습니다.",
        metaJson: JSON.stringify({ jobId: req.params.id, error: error instanceof Error ? error.message : String(error) })
      }
    });
    res.status(500).json({ ok: false, message: error instanceof Error ? error.message : "추적 작업 실행에 실패했습니다." });
  }
});

async function excludeSmartStoreProductIds(smartStoreProductIds: string[], reason: string) {
  const uniqueIds = Array.from(new Set(smartStoreProductIds.filter(Boolean)));

  await Promise.all(
    uniqueIds.map((smartStoreProductId) =>
      prisma.excludedProduct.upsert({
        where: { smartStoreProductId },
        update: { reason },
        create: { smartStoreProductId, reason }
      })
    )
  );
}

export { router };

