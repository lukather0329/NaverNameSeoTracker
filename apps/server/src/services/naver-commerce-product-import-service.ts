import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";

const NAVER_COMMERCE_BASE_URL = "https://api.commerce.naver.com/external";
const TOKEN_ENDPOINT = `${NAVER_COMMERCE_BASE_URL}/v1/oauth2/token`;
const PRODUCT_SEARCH_ENDPOINT = `${NAVER_COMMERCE_BASE_URL}/v1/products/search`;
const PRODUCT_PAGE_SIZE = 100;
const PRODUCT_STATUS_TYPES = ["WAIT", "SALE", "OUTOFSTOCK", "UNADMISSION", "REJECTION", "SUSPENSION", "CLOSE", "PROHIBITION"];

type CommerceApiAccount = {
  id: string;
  name: string;
  type: string;
  clientId: string;
  clientSecret: string;
  storeId: string | null;
  channelId: string | null;
};

type NaverCommerceTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

type NaverCommerceProductSearchResponse = {
  contents?: Array<{
    groupProductNo?: number | null;
    originProductNo?: number | null;
    channelProducts?: Array<{
      groupProductNo?: number | null;
      originProductNo?: number | null;
      channelProductNo?: number | null;
      categoryId?: string | null;
      name?: string | null;
      sellerManagementCode?: string | null;
      statusType?: string | null;
      salePrice?: number | null;
      discountedPrice?: number | null;
    }>;
  }>;
};

type ImportedCommerceProduct = {
  smartStoreProductId: string;
  originProductId: string | null;
  channelProductId: string | null;
  sellerManagementCode: string | null;
  currentTitle: string;
  category: string | null;
  price: number;
  productStatus: "ON_SALE" | "PAUSED" | "SOLD_OUT";
};

export type CommerceProductImportResult = {
  accountId: string;
  accountName: string;
  sellerIdentifier: string;
  totalFetched: number;
  importedCount: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  skippedCount: number;
  pageCount: number;
};

function hasProductChanged(
  existing: {
    originProductId: string | null;
    channelProductId: string | null;
    sellerManagementCode: string | null;
    currentTitle: string;
    category: string | null;
    price: number;
    productStatus: string;
    apiAccountId: string | null;
  },
  next: ImportedCommerceProduct,
  accountId: string
) {
  return (
    existing.originProductId !== next.originProductId ||
    existing.channelProductId !== next.channelProductId ||
    existing.sellerManagementCode !== next.sellerManagementCode ||
    existing.currentTitle !== next.currentTitle ||
    existing.category !== next.category ||
    existing.price !== next.price ||
    existing.productStatus !== next.productStatus ||
    existing.apiAccountId !== accountId
  );
}

export async function importProductsFromCommerceAccount(account: CommerceApiAccount): Promise<CommerceProductImportResult> {
  if (account.type !== "COMMERCE") {
    throw new Error("스마트스토어 상품 가져오기는 COMMERCE 계정에서만 지원합니다.");
  }

  if (!account.clientId.trim() || !account.clientSecret.trim()) {
    throw new Error("클라이언트 ID와 클라이언트 시크릿이 필요합니다.");
  }

  const sellerIdentifier = (account.channelId || account.storeId || "").trim();

  if (!sellerIdentifier) {
    throw new Error("채널 ID 또는 스토어 ID에 판매자 UID/ID를 먼저 저장해 주세요.");
  }

  const accessToken = await issueSellerAccessToken(account.clientId, account.clientSecret, sellerIdentifier);
  const remoteProducts = await fetchAllCommerceProducts(accessToken);

  let createdCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let skippedCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const product of remoteProducts) {
      if (!product.smartStoreProductId || !product.currentTitle.trim()) {
        skippedCount += 1;
        continue;
      }

      const existing = await tx.product.findUnique({
        where: { smartStoreProductId: product.smartStoreProductId }
      });

      if (existing) {
        if (!hasProductChanged(existing, product, account.id)) {
          unchangedCount += 1;
          continue;
        }

        await tx.product.update({
          where: { id: existing.id },
          data: {
            originProductId: product.originProductId,
            channelProductId: product.channelProductId,
            sellerManagementCode: product.sellerManagementCode,
            currentTitle: product.currentTitle,
            originalTitle: existing.originalTitle ?? product.currentTitle,
            category: product.category,
            price: product.price,
            productStatus: product.productStatus,
            apiAccountId: account.id
          }
        });
        updatedCount += 1;
      } else {
        await tx.product.create({
          data: {
            smartStoreProductId: product.smartStoreProductId,
            originProductId: product.originProductId,
            channelProductId: product.channelProductId,
            sellerManagementCode: product.sellerManagementCode,
            currentTitle: product.currentTitle,
            originalTitle: product.currentTitle,
            apiAccountId: account.id,
            seoOptimizedTitle: null,
            primaryKeyword: null,
            trackingKeywords: "",
            category: product.category,
            price: product.price,
            productStatus: product.productStatus,
            testStatus: "DRAFT"
          }
        });
        createdCount += 1;
      }
    }
  }, { timeout: 30000 });

  await prisma.systemLog.create({
    data: {
      level: "INFO",
      scope: "product-import",
      message: `${account.name} 계정 스마트스토어 상품 동기화 완료`,
      metaJson: JSON.stringify({
        accountId: account.id,
        sellerIdentifier,
        totalFetched: remoteProducts.length,
        createdCount,
        updatedCount,
        unchangedCount,
        skippedCount
      })
    }
  });

  return {
    accountId: account.id,
    accountName: account.name,
    sellerIdentifier,
    totalFetched: remoteProducts.length,
    importedCount: createdCount + updatedCount,
    createdCount,
    updatedCount,
    unchangedCount,
    skippedCount,
    pageCount: Math.max(1, Math.ceil(remoteProducts.length / PRODUCT_PAGE_SIZE))
  };
}

async function issueSellerAccessToken(clientId: string, clientSecret: string, sellerIdentifier: string) {
  const timestamp = Date.now().toString();
  const signature = Buffer.from(bcrypt.hashSync(`${clientId}_${timestamp}`, clientSecret), "utf8").toString("base64");
  const body = new URLSearchParams({
    client_id: clientId,
    timestamp,
    grant_type: "client_credentials",
    client_secret_sign: signature,
    type: "SELF",
    account_id: sellerIdentifier
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body
  });

  if (!response.ok) {
    throw new Error(await buildCommerceErrorMessage(response, "커머스 인증 토큰 발급에 실패했습니다."));
  }

  const payload = (await response.json()) as NaverCommerceTokenResponse;

  if (!payload.access_token) {
    throw new Error("커머스 인증 토큰이 비어 있습니다.");
  }

  return payload.access_token;
}

async function fetchAllCommerceProducts(accessToken: string) {
  const products: ImportedCommerceProduct[] = [];
  let page = 1;

  while (true) {
    const response = await fetch(PRODUCT_SEARCH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json;charset=UTF-8",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        page,
        size: PRODUCT_PAGE_SIZE,
        orderType: "NO",
        productStatusTypes: PRODUCT_STATUS_TYPES
      })
    });

    if (!response.ok) {
      throw new Error(await buildCommerceErrorMessage(response, "스마트스토어 상품 목록 조회에 실패했습니다."));
    }

    const payload = (await response.json()) as NaverCommerceProductSearchResponse;
    const pageProducts = (payload.contents ?? []).flatMap((group) =>
      (group.channelProducts ?? []).map((channelProduct) => ({
        smartStoreProductId: String(channelProduct.channelProductNo ?? "").trim(),
        originProductId: stringifyNumber(channelProduct.originProductNo ?? group.originProductNo ?? null),
        channelProductId: stringifyNumber(channelProduct.channelProductNo ?? null),
        sellerManagementCode: normalizeNullableString(channelProduct.sellerManagementCode),
        currentTitle: normalizeNullableString(channelProduct.name) ?? "",
        category: normalizeNullableString(channelProduct.categoryId),
        price: Math.max(0, channelProduct.discountedPrice ?? channelProduct.salePrice ?? 0),
        productStatus: mapCommerceProductStatus(channelProduct.statusType)
      }))
    );

    if (pageProducts.length === 0) {
      break;
    }

    products.push(...pageProducts);

    if (pageProducts.length < PRODUCT_PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return products;
}

function mapCommerceProductStatus(statusType?: string | null): "ON_SALE" | "PAUSED" | "SOLD_OUT" {
  if (statusType === "SALE") {
    return "ON_SALE";
  }

  if (statusType === "OUTOFSTOCK") {
    return "SOLD_OUT";
  }

  return "PAUSED";
}

function stringifyNumber(value: number | null | undefined) {
  return typeof value === "number" ? String(value) : null;
}

function normalizeNullableString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

async function buildCommerceErrorMessage(response: Response, fallbackMessage: string) {
  const text = await response.text();

  if (!text) {
    return `${fallbackMessage} (HTTP ${response.status})`;
  }

  try {
    const payload = JSON.parse(text) as {
      code?: string;
      message?: string;
      invalidInputs?: Array<{ name?: string; message?: string }>;
    };
    const invalidInputSummary = payload.invalidInputs
      ?.map((item) => [item.name, item.message].filter(Boolean).join(": "))
      .filter(Boolean)
      .join(", ");

    return [fallbackMessage, payload.code ? `code=${payload.code}` : "", payload.message ?? "", invalidInputSummary ?? ""]
      .filter(Boolean)
      .join(" | ");
  } catch {
    return `${fallbackMessage} (HTTP ${response.status}) ${text.slice(0, 300)}`;
  }
}
