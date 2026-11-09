// 馬會官方彩池狀態、派彩及場地探針讀數。全部係賽後／賽日事實，只作展示同研究參考，
// 絕不作凍結預測或模型輸入。數值保留馬會原文，另計每 $10 等值方便比較。

export type Venue = "ST" | "HV";
export type MeetingRef = { date: string; venue: Venue };

export type PoolStatusRow = {
  pool: string; leg: number; races: number[]; status: string | null;
  jackpot: number | null; estimated: number | null; merged: boolean; scrapedAt: string | null;
};
export type DividendRow = {
  pool: string; leg: number; races: number[]; kind: string; seq: number; combo: string;
  amount: number; partialUnit: number | null; per10: number;
};
export type ProbeRow = { instrument: "penetrometer" | "hammer"; time: string; reading: string };

export const POOL_LABEL: Record<string, string> = {
  WIN: "獨贏", PLA: "位置", QIN: "連贏", QPL: "位置Q", FCT: "二重彩", TCE: "三重彩", TRI: "單T",
  FF: "四連環", QTT: "四重彩", DBL: "孖寶", TBL: "三寶", DT: "孖T", TT: "三T", SixUP: "六環彩",
};
export const SINGLE_RACE_POOLS = ["WIN", "PLA", "QIN", "QPL", "FCT", "TCE", "TRI", "FF", "QTT"] as const;
export const CROSS_RACE_POOLS = ["DBL", "TBL", "DT", "TT", "SixUP"] as const;
const POOL_ORDER = [...SINGLE_RACE_POOLS, ...CROSS_RACE_POOLS] as readonly string[];
export const DIVIDEND_KIND_LABEL: Record<string, string> = { Winning: "派彩", Consolation: "安慰獎", "6WinBonus": "六寶獎金" };
export const SELL_STATUS_LABEL: Record<string, string> = { START_SELL: "開售中", STOP_SELL: "已停售" };
export const PROBE_LABEL = { penetrometer: "穿透儀讀數", hammer: "Clegg 撞錘讀數" } as const;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const int = (v: unknown) => { const n = Number(v); return v !== null && v !== "" && Number.isFinite(n) ? Math.trunc(n) : null; };
const money = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const races = (v: unknown): number[] | null => {
  const s = str(v);
  if (!s) return null;
  const out = s.split(",").map((x) => Number(x.trim()));
  return out.every((n) => Number.isInteger(n) && n >= 1 && n <= 14) ? out : null;
};
const poolOrder = (p: string) => { const i = POOL_ORDER.indexOf(p); return i < 0 ? 99 : i; };
export const poolLabel = (p: string) => POOL_LABEL[p] ?? p;

export function normalizeMeetings(rows: Record<string, unknown>[]): MeetingRef[] {
  const seen = new Set<string>(), out: MeetingRef[] = [];
  for (const r of rows) {
    const date = str(r["date"]), venue = r["venue"];
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || (venue !== "ST" && venue !== "HV")) continue;
    const k = `${date}|${venue}`;
    if (seen.has(k)) continue;
    seen.add(k); out.push({ date, venue });
  }
  return out.sort((a, b) => (a.date === b.date ? a.venue.localeCompare(b.venue) : a.date < b.date ? 1 : -1));
}

export function normalizePoolStatus(rows: Record<string, unknown>[]): PoolStatusRow[] {
  const out: PoolStatusRow[] = [];
  for (const r of rows) {
    const pool = str(r["pool"]), leg = int(r["leg"]), rs = races(r["races"]);
    if (!pool || leg === null || leg < 1 || !rs) continue;
    out.push({ pool, leg, races: rs, status: str(r["status"]), jackpot: money(r["jackpot"]), estimated: money(r["estimated"]), merged: Boolean(str(r["merged"])), scrapedAt: str(r["scrapedAt"]) });
  }
  return out.sort((a, b) => poolOrder(a.pool) - poolOrder(b.pool) || a.leg - b.leg);
}

/** 馬會部分單位派彩（例如「235,071.2／$1」）換算為每 $10：原額 × 10 ÷ 單位。 */
export function per10(amount: number, partial: boolean, unit: number | null): number | null {
  if (!partial) return amount;
  if (!unit || unit <= 0 || unit > 10) return null;
  return Math.round((amount * 10 / unit) * 100) / 100;
}

export function normalizeDividends(rows: Record<string, unknown>[]): DividendRow[] {
  const out: DividendRow[] = [];
  for (const r of rows) {
    const pool = str(r["pool"]), leg = int(r["leg"]), rs = races(r["races"]), kind = str(r["kind"]), seq = int(r["seq"]);
    const combo = str(r["combo"]), amount = money(r["amount"]);
    if (!pool || leg === null || !rs || !kind || seq === null || !combo || amount === null) continue;
    if (str(r["status"]) !== "OFFICIAL") continue;
    const partial = int(r["partial"]) === 1, unit = int(r["partialUnit"]);
    const p10 = per10(amount, partial, unit);
    if (p10 === null) continue;
    out.push({ pool, leg, races: rs, kind, seq, combo, amount, partialUnit: partial ? unit : null, per10: p10 });
  }
  return out.sort((a, b) => poolOrder(a.pool) - poolOrder(b.pool) || a.leg - b.leg || a.seq - b.seq);
}

export function normalizeProbes(rows: Record<string, unknown>[]): ProbeRow[] {
  const out: ProbeRow[] = [];
  for (const r of rows) {
    const instrument = r["instrument"], time = str(r["time"]), reading = str(r["reading"]);
    if ((instrument !== "penetrometer" && instrument !== "hammer") || !time || !reading) continue;
    out.push({ instrument, time, reading });
  }
  return out.sort((a, b) => a.time.localeCompare(b.time) || a.instrument.localeCompare(b.instrument));
}

/** 單場彩池按場次分組；每場依獨贏→四重彩次序。 */
export function dividendsByRace(rows: DividendRow[]): { race: number; pools: { pool: string; rows: DividendRow[] }[] }[] {
  const map = new Map<number, Map<string, DividendRow[]>>();
  for (const r of rows) {
    if (r.races.length !== 1 || !(SINGLE_RACE_POOLS as readonly string[]).includes(r.pool)) continue;
    const race = r.races[0]!;
    const byPool = map.get(race) ?? new Map<string, DividendRow[]>();
    byPool.set(r.pool, [...(byPool.get(r.pool) ?? []), r]);
    map.set(race, byPool);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([race, byPool]) => ({
    race, pools: [...byPool.entries()].sort((a, b) => poolOrder(a[0]) - poolOrder(b[0])).map(([pool, rs]) => ({ pool, rows: rs })),
  }));
}

/** 跨場彩池（孖寶、三寶、孖T、三T、六環彩）逐關列出。 */
export function crossRaceDividends(rows: DividendRow[]): DividendRow[] {
  return rows.filter((r) => (CROSS_RACE_POOLS as readonly string[]).includes(r.pool));
}

export type StatusSummary = { pool: string; races: number[]; legs: number; counts: Record<string, number> };
/** 彩池狀態摘要：每種彩池一行計各狀態數；有多寶或預計派彩嘅跨場彩池關次另列。 */
export function summarizeStatus(rows: PoolStatusRow[]): { pools: StatusSummary[]; featured: PoolStatusRow[] } {
  const map = new Map<string, StatusSummary>();
  for (const r of rows) {
    const s = map.get(r.pool) ?? { pool: r.pool, races: [], legs: 0, counts: {} };
    s.races.push(...r.races); s.legs += 1;
    const k = r.status ?? "UNKNOWN";
    s.counts[k] = (s.counts[k] ?? 0) + 1;
    map.set(r.pool, s);
  }
  return {
    pools: [...map.values()].map((s) => ({ ...s, races: [...new Set(s.races)].sort((a, b) => a - b) })).sort((a, b) => poolOrder(a.pool) - poolOrder(b.pool)),
    featured: rows.filter((r) => (CROSS_RACE_POOLS as readonly string[]).includes(r.pool) && (r.jackpot || r.estimated)),
  };
}

export const hkd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
export const raceSpan = (rs: number[]) => (rs.length === 1 ? `第${rs[0]}場` : `第${rs.join("、")}場`);
