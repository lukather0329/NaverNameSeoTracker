import { createHmac } from "node:crypto";
import bcrypt from "bcryptjs";

type StoredApiAccount = {
  type: string;
  clientId: string;
  clientSecret: string;
  accessLicense: string | null;
  secretKey: string | null;
  customerId: string | null;
  storeId: string | null;
  channelId: string | null;
};

export type ApiConnectionTestResult = {
  ok: boolean;
  mode: "real" | "validation";
  message: string;
  details?: string;
  statusCode?: number;
};

const NAVER_SEARCH_AD_BASE_URL = "https://api.searchad.naver.com";
const NAVER_SEARCH_AD_TEST_URI = "/ncc/campaigns";
const NAVER_COMMERCE_BASE_URL = "https://api.commerce.naver.com/external";
const NAVER_COMMERCE_TOKEN_ENDPOINT = `${NAVER_COMMERCE_BASE_URL}/v1/oauth2/token`;
const NAVER_COMMERCE_PRODUCT_SEARCH_ENDPOINT = `${NAVER_COMMERCE_BASE_URL}/v1/products/search`;
const NAVER_COMMERCE_PRODUCT_STATUS_TYPES = ["WAIT", "SALE", "OUTOFSTOCK", "UNADMISSION", "REJECTION", "SUSPENSION", "CLOSE", "PROHIBITION"];

export async function testNaverApiConnection(account: StoredApiAccount): Promise<ApiConnectionTestResult> {
  if (account.type === "SEARCH_AD") {
    return testSearchAdConnection(account);
  }

  if (account.type === "COMMERCE") {
    return testCommerceConnection(account);
  }

  return account.clientId && account.clientSecret
    ? {
        ok: true,
        mode: "validation",
        message: "기본 자격정보가 저장되어 있습니다. 이 계정 유형의 실연동 테스트는 아직 정의되지 않았습니다."
      }
    : {
        ok: false,
        mode: "validation",
        message: "클라이언트 ID와 클라이언트 시크릿이 필요합니다."
      };
}

async function testSearchAdConnection(account: StoredApiAccount): Promise<ApiConnectionTestResult> {
  if (!account.accessLicense || !account.secretKey || !account.customerId) {
    return {
      ok: false,
      mode: "validation",
      message: "검색광고 실테스트에는 액세스 라이선스, 시크릿 키, 고객 ID가 필요합니다."
    };
  }

  const timestamp = Date.now().toString();
  const signature = createHmac("sha256", account.secretKey)
    .update(`${timestamp}.GET.${NAVER_SEARCH_AD_TEST_URI}`)
    .digest("base64");

  try {
    const response = await fetch(`${NAVER_SEARCH_AD_BASE_URL}${NAVER_SEARCH_AD_TEST_URI}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Timestamp": timestamp,
        "X-API-KEY": account.accessLicense,
        "X-Customer": account.customerId,
        "X-Signature": signature
      }
    });

    const bodyText = await response.text();
    const details = bodyText.slice(0, 300);

    if (response.ok) {
      return {
        ok: true,
        mode: "real",
        statusCode: response.status,
        message: "네이버 검색광고 실연동 테스트에 성공했습니다.",
        details
      };
    }

    return {
      ok: false,
      mode: "real",
      statusCode: response.status,
      message: "네이버 검색광고 인증 또는 요청 오류가 반환되었습니다.",
      details
    };
  } catch (error) {
    return {
      ok: false,
      mode: "real",
      message: "네이버 검색광고 실연동 테스트 중 네트워크 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

async function testCommerceConnection(account: StoredApiAccount): Promise<ApiConnectionTestResult> {
  const sellerIdentifier = (account.channelId || account.storeId || "").trim();

  if (!account.clientId.trim() || !account.clientSecret.trim()) {
    return {
      ok: false,
      mode: "validation",
      message: "커머스 실테스트에는 클라이언트 ID와 클라이언트 시크릿이 필요합니다."
    };
  }

  if (!sellerIdentifier) {
    return {
      ok: false,
      mode: "validation",
      message: "커머스 실테스트에는 스토어 ID 또는 채널 ID 중 하나가 필요합니다."
    };
  }

  try {
    const accessToken = await issueCommerceAccessToken(account.clientId, account.clientSecret, sellerIdentifier);
    const productResponse = await fetch(NAVER_COMMERCE_PRODUCT_SEARCH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json;charset=UTF-8",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        page: 1,
        size: 1,
        orderType: "NO",
        productStatusTypes: NAVER_COMMERCE_PRODUCT_STATUS_TYPES
      })
    });

    const responseText = await productResponse.text();
    const details = responseText.slice(0, 300);

    if (!productResponse.ok) {
      return {
        ok: false,
        mode: "real",
        statusCode: productResponse.status,
        message: "네이버 커머스 상품 조회 테스트에 실패했습니다.",
        details: await buildCommerceErrorMessageFromText(productResponse.status, responseText, "커머스 상품 조회 오류")
      };
    }

    let fetchedCount = 0;
    try {
      const payload = JSON.parse(responseText) as { contents?: unknown[] };
      fetchedCount = Array.isArray(payload.contents) ? payload.contents.length : 0;
    } catch {
      fetchedCount = 0;
    }

    return {
      ok: true,
      mode: "real",
      statusCode: productResponse.status,
      message: "네이버 커머스 실연동 테스트에 성공했습니다.",
      details: fetchedCount > 0 ? `상품 응답 ${fetchedCount}건 확인` : details || "상품 조회 응답 확인 완료"
    };
  } catch (error) {
    return {
      ok: false,
      mode: "real",
      message: "네이버 커머스 실연동 테스트 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

async function issueCommerceAccessToken(clientId: string, clientSecret: string, sellerIdentifier: string) {
  const timestamp = Date.now().toString();
  const signature = Buffer.from(bcrypt.hashSync(`${clientId}_${timestamp}`, clientSecret), "utf8").toString("base64");
  const body = new URLSearchParams({
    client_id: clientId,
    timestamp,
    grant_type: "client_credentials",
    client_secret_sign: signature,
    type: "SELLER",
    account_id: sellerIdentifier
  });

  const response = await fetch(NAVER_COMMERCE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(await buildCommerceErrorMessageFromText(response.status, responseText, "커머스 인증 토큰 발급에 실패했습니다."));
  }

  const payload = JSON.parse(responseText) as { access_token?: string };

  if (!payload.access_token) {
    throw new Error("커머스 인증 토큰이 비어 있습니다.");
  }

  return payload.access_token;
}

async function buildCommerceErrorMessageFromText(statusCode: number, text: string, fallbackMessage: string) {
  if (!text) {
    return `${fallbackMessage} (HTTP ${statusCode})`;
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
    return `${fallbackMessage} (HTTP ${statusCode}) ${text.slice(0, 300)}`;
  }
}
