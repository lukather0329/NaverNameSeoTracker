import type { RankLookupInput, RankLookupResult, RankProvider } from "./rank-provider.js";

export class NaverShoppingRankProvider implements RankProvider {
  kind = "NAVER_SHOPPING" as const;

  async lookup(_input: RankLookupInput): Promise<RankLookupResult> {
    throw new Error("NaverShoppingRankProvider is not enabled yet. Use mock provider or attach a compliant adapter.");
  }
}
