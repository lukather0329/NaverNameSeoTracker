import { createHmac } from "node:crypto";

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

export async function testNaverApiConnection(account: StoredApiAccount): Promise<ApiConnectionTestResult> {
  if (account.type === "SEARCH_AD") {
    return testSearchAdConnection(account);
  }

  if (account.type === "COMMERCE") {
    const hasBaseCredentials = Boolean(account.clientId && account.clientSecret);
    const hasCommerceCredentials = Boolean(
      account.accessLicense && account.secretKey && (account.storeId || account.channelId)
    );

    return hasBaseCredentials && hasCommerceCredentials
      ? {
          ok: true,
          mode: "validation",
          message: "Commerce API required credentials look valid. Live external calls will be added in a follow-up adapter."
        }
      : {
          ok: false,
          mode: "validation",
          message: "Commerce API credentials are incomplete. Check Access License, Secret Key, and Store or Channel ID."
        };
  }

  return account.clientId && account.clientSecret
    ? {
        ok: true,
        mode: "validation",
        message: "Basic credentials are present. A live connection test is not defined for this account type yet."
      }
    : {
        ok: false,
        mode: "validation",
        message: "Client ID and Client Secret are required."
      };
}

async function testSearchAdConnection(account: StoredApiAccount): Promise<ApiConnectionTestResult> {
  if (!account.accessLicense || !account.secretKey || !account.customerId) {
    return {
      ok: false,
      mode: "validation",
      message: "SearchAd live test requires Access License, Secret Key, and Customer ID."
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
        message: "Naver SearchAd live connection test succeeded.",
        details
      };
    }

    return {
      ok: false,
      mode: "real",
      statusCode: response.status,
      message: "Naver SearchAd returned an authentication or request error.",
      details
    };
  } catch (error) {
    return {
      ok: false,
      mode: "real",
      message: "Network error occurred during the Naver SearchAd live connection test.",
      details: error instanceof Error ? error.message : "Unknown error"
    };
  }
}