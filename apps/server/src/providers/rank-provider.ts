export interface RankLookupInput {
  keyword: string;
  productId: string;
  currentTitle: string;
  smartStoreProductId?: string | null;
  originProductId?: string | null;
}

export interface RankLookupResult {
  currentRank: number | null;
  searchPage: number | null;
  foundTitle: string | null;
  foundProductRef: string | null;
}

export interface RankProvider {
  kind: "MOCK" | "NAVER_SHOPPING" | "FUTURE_API";
  lookup(input: RankLookupInput): Promise<RankLookupResult>;
}
