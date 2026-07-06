import type { RankProvider } from "./rank-provider.js";

export class NaverShoppingRankProvider implements RankProvider {
  kind = "NAVER_SHOPPING" as const;

  async lookup(_input: { keyword: string; productId: string; currentTitle: string }) {
    throw new Error("NaverShoppingRankProvider is not enabled yet. Use mock provider or attach a compliant adapter.");
  }
}
