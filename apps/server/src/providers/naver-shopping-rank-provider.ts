import type { RankLookupInput, RankLookupResult, RankProvider } from "./rank-provider.js";

const OPEN_API_SHOP_SEARCH_URL = "https://openapi.naver.com/v1/search/shop.json";
const ITEMS_PER_PAGE = 100;
// 네이버쇼핑 가격비교 화면은 보통 40개씩 페이징된다. 광고 없는 순수 가격비교 순위이므로
// 상위 5페이지(최대 500개)까지만 확인해도 실사용 목적(1~수백 위권 추적)에는 충분하다.
const MAX_PAGES = 5;

type OpenApiShopItem = {
  title?: string;
  link?: string;
  mallName?: string;
  productId?: string;
};

type OpenApiShopSearchResponse = {
  items?: OpenApiShopItem[];
};

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]*>/g, "");
}

// 비교용으로 공백/기호를 제거하고 소문자로 맞춘 문자열을 만든다.
function normalizeForMatch(value: string) {
  return stripHtmlTags(value)
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]/g, "");
}

// smartstore.naver.com/.../products/{id} 또는 shopping.naver.com 링크에 포함된
// 상품 번호 같은 숫자 조각을 전부 뽑아낸다. 원상품번호/채널상품번호 둘 중 하나라도
// 링크 안의 숫자와 일치하면 같은 상품으로 본다.
function extractNumericFragments(value: string): string[] {
  return value.match(/\d{6,}/g) ?? [];
}

export class NaverShoppingRankProvider implements RankProvider {
  kind = "NAVER_SHOPPING" as const;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string
  ) {}

  async lookup(input: RankLookupInput): Promise<RankLookupResult> {
    const idCandidates = [input.smartStoreProductId, input.originProductId]
      .filter((value): value is string => Boolean(value && value.trim()))
      .map((value) => value.trim());
    const normalizedTitle = normalizeForMatch(input.currentTitle);

    let globalRank = 0;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const start = page * ITEMS_PER_PAGE + 1;
      const url = `${OPEN_API_SHOP_SEARCH_URL}?query=${encodeURIComponent(input.keyword)}&display=${ITEMS_PER_PAGE}&start=${start}&sort=sim`;

      const response = await fetch(url, {
        headers: {
          "X-Naver-Client-Id": this.clientId,
          "X-Naver-Client-Secret": this.clientSecret
        }
      });

      if (!response.ok) {
        const bodyText = await response.text().catch(() => "");
        throw new Error(
          `네이버 오픈API 쇼핑검색 요청이 실패했습니다 (HTTP ${response.status}). ${bodyText.slice(0, 200)}`
        );
      }

      const payload = (await response.json()) as OpenApiShopSearchResponse;
      const items = payload.items ?? [];

      if (items.length === 0) {
        break;
      }

      for (const item of items) {
        globalRank += 1;

        const link = item.link ?? "";
        const linkFragments = extractNumericFragments(link);
        const matchesById =
          idCandidates.length > 0 && linkFragments.length > 0 && idCandidates.some((id) => linkFragments.includes(id));
        const matchesByTitle = normalizedTitle.length > 0 && normalizeForMatch(item.title ?? "") === normalizedTitle;

        if (matchesById || matchesByTitle) {
          return {
            currentRank: globalRank,
            // 네이버쇼핑 화면은 40개씩 노출되므로 그 기준으로 몇 번째 페이지인지 환산한다.
            searchPage: Math.ceil(globalRank / 40),
            foundTitle: stripHtmlTags(item.title ?? input.currentTitle),
            foundProductRef: link || null
          };
        }
      }

      if (items.length < ITEMS_PER_PAGE) {
        break;
      }
    }

    // 상위 노출권(최대 500위)에서 찾지 못함 = 순위 이탈(OUT)로 처리한다.
    return {
      currentRank: null,
      searchPage: null,
      foundTitle: null,
      foundProductRef: null
    };
  }
}
