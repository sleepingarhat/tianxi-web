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

// 騎師王（JKC）／練馬師王（TNC）彩池板：馬會官方賠率原文、最後名次及積分。只作參考，不計入預測。
export type ChallengeRow = { kind: "JKC" | "TNC"; name: string; odds: string | null; order: number | null; points: number | null; rides: number | null };
export type ChallengeBoard = { kind: "JKC" | "TNC"; status: string | null; races: string | null; rows: ChallengeRow[] };

export function normalizeChallenge(pools: Record<string, unknown>[], rows: Record<string, unknown>[]): ChallengeBoard[] {
  const boards: ChallengeBoard[] = [];
  for (const kind of ["JKC", "TNC"] as const) {
    const pool = pools.find((p) => p["kind"] === kind);
    if (!pool) continue;
    const list: ChallengeRow[] = [];
    for (const r of rows) {
      if (r["kind"] !== kind || int(r["isOther"]) === 1) continue;
      const name = str(r["name"]);
      if (!name) continue;
      const rawOdds = str(r["odds"]);
      const pts = Number(r["points"]);
      list.push({
        kind, name,
        // 9999 係馬會頁「已無機會」嘅佔位，唔當成賠率顯示。
        odds: rawOdds && rawOdds !== "9999" ? rawOdds : null,
        order: int(r["finalOrder"]),
        points: r["points"] == null || r["points"] === "" || !Number.isFinite(pts) ? null : pts,
        rides: int(r["rides"]),
      });
    }
    list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || Number(a.odds ?? 1e9) - Number(b.odds ?? 1e9) || a.name.localeCompare(b.name));
    boards.push({ kind, status: str(pool["status"]), races: str(pool["races"]), rows: list });
  }
  return boards;
}
