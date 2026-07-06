import type { RankProvider } from "./rank-provider.js";

export class MockRankProvider implements RankProvider {
  kind = "MOCK" as const;

  async lookup(input: { keyword: string; productId: string; currentTitle: string }) {
    const seed = [...input.keyword, ...input.productId].reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const rank = (seed % 30) + 1;

    return {
      currentRank: rank,
      searchPage: Math.ceil(rank / 20),
      foundTitle: input.currentTitle,
      foundProductRef: `mock://${input.productId}`
    };
  }
}
