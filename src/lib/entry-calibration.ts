// 入場（入 Q／頭四）排名 vs 實際成績：只讀對照，唔改任何凍結數值。
import { entryRankMap, type EntrySource } from "./entry-rank";

export type EntryActualRow = { horseNumber: string; pTop4: number; entryRank: number; finish: number | null; inQ: boolean };

export function entryVsActual(picks: EntrySource[], finishes: Record<string, number>) {
  const ranks = entryRankMap(picks);
  const rows: EntryActualRow[] = (picks || [])
    .filter((p) => ranks.has(String(p.horseNumber)))
    .map((p) => {
      const k = String(p.horseNumber);
      const f = finishes[k];
      const finish = typeof f === "number" && f >= 1 ? f : null;
      return { horseNumber: k, pTop4: p.pTop4 as number, entryRank: ranks.get(k)!, finish, inQ: finish != null && finish <= 4 };
    })
    .filter((r) => r.finish != null)
    .sort((a, b) => a.entryRank - b.entryRank);
  const top = rows.filter((r) => r.entryRank <= 4);
  return {
    rows,
    /** 入場排名頭四：模型預期入 Q 匹數（pTop4 總和） vs 實際入 Q 匹數 */
    expectedTop: top.reduce((a, r) => a + r.pTop4, 0),
    actualTop: top.filter((r) => r.inQ).length,
    topCount: top.length,
    /** 全場：預期入 Q 總數 vs 實際 */
    expectedAll: rows.reduce((a, r) => a + r.pTop4, 0),
    actualAll: rows.filter((r) => r.inQ).length,
  };
}
