// 馬會官方公開統計（騎練榜、檔位統計、已存檔更易）。只作展示，絕不作凍結預測輸入。
export type RankingRow = { role: "jockey" | "trainer"; rank: number; name: string; wins: number; seconds: number; thirds: number; starts: number };
export type DrawStatRow = { raceNumber: number; draw: number; starts: number; winPct: number; placePct: number; distance: number | null; course: string | null };
export type ArchivedChangeRow = { raceNumber: number; horseNumber: number | null; horseName: string | null; changeType: string; after: string | null };

const int = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : null; };
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function normalizeRanking(rows: Record<string, unknown>[], limit = 5): { jockey: RankingRow[]; trainer: RankingRow[]; asOf: string | null; season: string | null } {
  const out = { jockey: [] as RankingRow[], trainer: [] as RankingRow[] };
  let asOf: string | null = null, season: string | null = null;
  for (const r of rows) {
    const role = r["role"] === "trainer" ? "trainer" : r["role"] === "jockey" ? "jockey" : null;
    const rank = int(r["rank"]), wins = int(r["wins"]), starts = int(r["starts"]), name = str(r["name"]);
    if (!role || rank === null || rank < 1 || wins === null || starts === null || !name) continue;
    asOf ??= str(r["asOf"]); season ??= str(r["season"]);
    out[role].push({ role, rank, name, wins, seconds: int(r["seconds"]) ?? 0, thirds: int(r["thirds"]) ?? 0, starts });
  }
  for (const k of ["jockey", "trainer"] as const) out[k] = out[k].sort((a, b) => a.rank - b.rank).slice(0, limit);
  return { ...out, asOf, season };
}

export function normalizeDrawStats(rows: Record<string, unknown>[]): DrawStatRow[] {
  const out: DrawStatRow[] = [];
  for (const r of rows) {
    const raceNumber = int(r["raceNumber"]), draw = int(r["draw"]), starts = int(r["starts"]);
    const winPct = int(r["winPct"]), placePct = int(r["placePct"]);
    if (!raceNumber || raceNumber < 1 || raceNumber > 14 || !draw || draw < 1 || starts === null || starts < 0) continue;
    if (winPct === null || placePct === null || winPct < 0 || winPct > 100 || placePct < 0 || placePct > 100) continue;
    const d = int(r["distance"]);
    out.push({ raceNumber, draw, starts, winPct, placePct, distance: d && d > 0 ? d : null, course: str(r["course"]) });
  }
  return out.sort((a, b) => a.raceNumber - b.raceNumber || a.draw - b.draw);
}

export function normalizeArchivedChanges(rows: Record<string, unknown>[]): ArchivedChangeRow[] {
  const out: ArchivedChangeRow[] = [];
  for (const r of rows) {
    const raceNumber = int(r["raceNumber"]), changeType = str(r["changeType"]);
    if (!raceNumber || raceNumber < 1 || raceNumber > 14 || !changeType) continue;
    out.push({ raceNumber, horseNumber: int(r["horseNumber"]), horseName: str(r["horseName"]), changeType, after: str(r["after"]) });
  }
  return out;
}

export function changeCountByRace(rows: ArchivedChangeRow[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const r of rows) m.set(r.raceNumber, (m.get(r.raceNumber) ?? 0) + 1);
  return m;
}

/** 勝出率最高檔位（樣本少於 20 次不計，避免小樣本誤導）。 */
export function bestDraws(rows: DrawStatRow[], raceNumber: number, n = 3, minStarts = 20): DrawStatRow[] {
  return rows.filter((r) => r.raceNumber === raceNumber && r.starts >= minStarts)
    .sort((a, b) => b.winPct - a.winPct || b.placePct - a.placePct || a.draw - b.draw).slice(0, n);
}
