/** 彩池優化器 UI 常數／純函式（研究層）。 */

export const POOLS_RESEARCH_BANNER = "研究用・唔係官方建議・唔入公開戰績";

export const POOLS_DISCLAIMER_EXTRA =
  "無一鍵投注、無臨場值博計算。官方凍結四揀唔會被此頁改寫。";

export const POOLS_PAGE_DESC = "凍結 pWin + Harville／PL · 無臨場賠率 · 無落注連結";

export type PoolOptimizeMethod = "top_k" | "banker_box";

export type PoolOptimizeParams = {
  pool: string;
  raceIds: string[];
  budget: number;
  method: PoolOptimizeMethod;
};

/** 解析 raceId 輸入（逗號／空白分隔）。 */
export function parseRaceIdsInput(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 組 optimize 請求 shape；budget 無效或冇 raceId → null。 */
export function buildOptimizeParams(input: {
  pool: string;
  raceIdsText: string;
  budget: string | number;
  method?: string;
}): PoolOptimizeParams | null {
  const raceIds = parseRaceIdsInput(
    typeof input.raceIdsText === "string" ? input.raceIdsText : "",
  );
  const budget = typeof input.budget === "number" ? input.budget : Number(input.budget);
  if (!raceIds.length || !Number.isFinite(budget) || budget <= 0) return null;
  const method: PoolOptimizeMethod =
    input.method === "banker_box" ? "banker_box" : "top_k";
  return {
    pool: input.pool,
    raceIds,
    budget,
    method,
  };
}

/** 合規：結果不得帶投注 URL。 */
export function assertNoBetUrls(result: {
  betUrl?: unknown;
  placeBetUrl?: unknown;
}): boolean {
  return result.betUrl == null && result.placeBetUrl == null;
}
