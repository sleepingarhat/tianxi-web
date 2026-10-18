// 天喜 · 入場（入 Q／入頭四）排名：只讀派生，唔改任何凍結數值。
// 名次按模型 pTop4（該馬進入實際頭四名嘅機率）降序；同機率並列同名次，缺值不計名次。

export type EntrySource = {
  horseNumber: string | number;
  pTop4?: number | null;
};

/** 回傳 馬號 → 入場排名（1 起跳）。缺 pTop4 嘅馬唔會出而家表。 */
export function entryRankMap(picks: EntrySource[]): Map<string, number> {
  const scored = (picks || [])
    .filter((p) => typeof p.pTop4 === "number" && isFinite(p.pTop4 as number))
    .map((p) => ({ key: String(p.horseNumber), v: p.pTop4 as number }))
    .sort((a, b) => b.v - a.v);

  const out = new Map<string, number>();
  let lastV: number | null = null;
  let lastRank = 0;
  scored.forEach((s, i) => {
    const rank = lastV !== null && s.v === lastV ? lastRank : i + 1;
    out.set(s.key, rank);
    lastV = s.v;
    lastRank = rank;
  });
  return out;
}
