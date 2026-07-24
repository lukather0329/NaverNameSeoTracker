import { prisma } from "../lib/prisma.js";
import { decryptSecret } from "../lib/crypto.js";
import { buildCommerceErrorMessage, issueSellerAccessToken } from "./naver-commerce-product-import-service.js";

const NAVER_COMMERCE_ORIGIN_PRODUCT_ENDPOINT = "https://api.commerce.naver.com/external/v2/products/origin-products";

type PublishableProduct = {
  id: string;
  currentTitle: string;
  seoOptimizedTitle: string | null;
  originProductId: string | null;
  apiAccountId: string | null;
};

export type PublishTitleResult = {
  previousName: string | null;
  newName: string;
};

export async function publishProductTitleToNaver(product: PublishableProduct): Promise<PublishTitleResult> {
  const newTitle = product.seoOptimizedTitle?.trim();

  if (!newTitle) {
    throw new Error("SEO 상품명을 먼저 입력해 주세요.");
  }

  if (!product.originProductId) {
    throw new Error("원상품 ID 정보가 없어 전송할 수 없습니다. 스마트스토어 상품 불러오기를 다시 실행해 주세요.");
  }

  if (!product.apiAccountId) {
    throw new Error("이 상품의 동기화 출처 계정 정보가 없습니다. 스마트스토어 상품 불러오기를 다시 실행해 주세요.");
  }

  const account = await prisma.apiAccount.findUnique({ where: { id: product.apiAccountId } });

  if (!account) {
    throw new Error("연결된 API 계정을 찾을 수 없습니다.");
  }

  const sellerIdentifier = (account.channelId || account.storeId || "").trim();

  if (!sellerIdentifier) {
    throw new Error("계정에 스토어 ID 또는 채널 ID가 없습니다.");
  }

  const clientSecret = decryptSecret(account.clientSecret) ?? account.clientSecret;
  const accessToken = await issueSellerAccessToken(account.clientId, clientSecret, sellerIdentifier);
  const url = `${NAVER_COMMERCE_ORIGIN_PRODUCT_ENDPOINT}/${product.originProductId}`;

  const getResponse = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });

  if (!getResponse.ok) {
    throw new Error(await buildCommerceErrorMessage(getResponse, "네이버 상품 조회에 실패했습니다."));
  }

  const current = (await getResponse.json()) as { originProduct?: { name?: string } };

  if (!current.originProduct) {
    throw new Error("네이버 상품 응답 형식이 예상과 달라 반영할 수 없습니다.");
  }

  const previousName = current.originProduct.name ?? null;
  current.originProduct.name = newTitle;

  const putResponse = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(current)
  });

  if (!putResponse.ok) {
    throw new Error(await buildCommerceErrorMessage(putResponse, "네이버 상품명 반영에 실패했습니다."));
  }

  return { previousName, newName: newTitle };
}
