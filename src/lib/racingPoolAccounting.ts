import { queryOptions } from "@tanstack/react-query";
import { fetchRaceDividends, type DividendRow } from "./raceDividends";
import { frozenPoolLegs, type FrozenPoolRace, type FrozenPoolLeg } from "./frozen-pool-legs";
import { settleWithdrawnLeg } from "./exotic-withdrawal";
import { getOfficialFavourites } from "./official-favourites.functions";
import { favouriteOrderForSettlement, type OfficialFavourites } from "./official-favourites";
import { getHkjcChanges } from "./hkjc-changes.functions";
import { officialWithdrawal } from './hkjc-changes';

const UNIT = 10;

type Leg = FrozenPoolLeg | null;
type PoolEvidenceRace = Omit<FrozenPoolRace, 'picks'> & {picks: Array<{horseNumber:number;rank:number;nameCh?:string;horseId?:string}>};
export type PoolCalc = {
  name: string; races: number[]; units: number; cost: number;
  mainHit: boolean; payout: number; consUnits: number; consPayout: number;
  mainDividend: number | null; consolationDividend: number | null;
  missing: boolean; pendingWithdrawal: boolean; pendingSettlement: boolean; detail: { race: number; hit: boolean | null; original: Leg; settled: Leg; settledCombinations: number[][] | null; winningCombination: string | null }[];
};

type Match = boolean | null;
const isAny = (s: string) => s === "任何組合" || s === "F";
const setOf = (s: string) => new Set(s.split(",").map(Number).filter(n => Number.isInteger(n) && n > 0));
function ticketHit(ticket: number[], part: string): Match {
  if (isAny(part)) return true;
  if (!/^\d+\s*,\s*\d+\s*,\s*\d+$/.test(part)) return null;
  const win = setOf(part);
  return win.size === 3 ? ticket.every(n => win.has(n)) : null;
}
const combinationHit = (hits: Match[]): Match => hits.includes(false) ? false : hits.includes(null) ? null : true;

export function calcPools(divs: DividendRow[], legsByRace: Record<number, Leg>, withdrawnByRace: Record<number, Set<number>> = {}, favouritesByRace: Record<number, number[] | undefined> = {}): PoolCalc[] {
  const groups = new Map<string, { name: string; main: DividendRow[]; cons: DividendRow[] }>();
  for (const d of divs) {
    if (!/孖T|三T/.test(d.pool)) continue;
    const name = d.pool.replace(/\(安慰獎\)|（安慰獎）/, "").trim();
    const key = `${d.race_no}:${name}`;
    const g = groups.get(key) ?? { name, main: [], cons: [] };
    const target = /安慰獎/.test(d.pool) ? g.cons : g.main;
    if (!target.some(r => r.combo === d.combo && r.dividend === d.dividend)) target.push(d);
    groups.set(key, g);
  }
  const out: PoolCalc[] = [];
  for (const g of groups.values()) {
    const ref = g.main[0] ?? g.cons[0];
    if (!ref) continue;
    const n = /三T/.test(g.name) ? 3 : 2;
    const races = Array.from({ length: n }, (_, i) => ref.race_no - n + 1 + i);
    const original = races.map(r => legsByRace[r] ?? null);
    const settlements = original.map((leg, i) => leg ? settleWithdrawnLeg(leg, withdrawnByRace[races[i] ?? 0] ?? new Set(), favouritesByRace[races[i] ?? 0]) : null);
    const pendingWithdrawal = settlements.some(s => s?.status === 'pending');
    let missing = pendingWithdrawal || original.some(l => !l) || !g.main.length;
    const units = original.reduce((acc, l) => acc * (l?.legs.length ?? 0), 1);
    const mainParts = g.main[0]?.combo.split('/').map(s => s.trim()) ?? [];
    const detail = races.map((race, i) => {
      const tickets = settlements[i]?.combinations;
      const hits = tickets?.map(t => ticketHit(t, mainParts[i] ?? '')) ?? [];
      return { race, hit: !missing && hits.length ? hits.includes(true) ? true : hits.includes(null) ? null : false : null,
        original: original[i] ?? null, settled: settlements[i]?.status === 'pending' ? null : settlements[i] ? { ...original[i], ...settlements[i]?.leg, fifthFromLive: false as const } : null,
        settledCombinations: tickets ?? null, winningCombination: mainParts[i] ?? null };
    });
    const allTickets = settlements.reduce<number[][][]>((acc, s) => acc.flatMap(prefix => (s?.combinations ?? []).map(ticket => [...prefix, ticket])), [[]]);
    let payout = 0, consPayout = 0, consUnits = 0;
    for (const tickets of allTickets) {
      const matchRow = (row: DividendRow): Match => {
        const parts = row.combo.split('/').map(s => s.trim());
        if (parts.length !== n || !Number.isFinite(row.dividend) || row.dividend < 0) return null;
        return combinationHit(tickets.map((t, i) => ticketHit(t, parts[i] ?? '')));
      };
      const mains = g.main.map(row => ({ row, hit: matchRow(row) }));
      const mainWon = mains.some(m => m.hit === true);
      if (mains.some(m => m.hit === null)) missing = true;
      for (const m of mains) if (m.hit === true) payout += m.row.dividend;
      // Consolation pays non-main-winning original tickets only; preserve multiplicities.
      if (!mainWon) for (const row of g.cons) {
        const hit = matchRow(row);
        if (hit === null) missing = true;
        if (hit === true) { consUnits++; consPayout += row.dividend; }
      }
    }
    if (missing) { payout = 0; consPayout = 0; consUnits = 0; }
    out.push({ name: g.name, races, units, cost: units * UNIT, mainHit: !missing && payout > 0,
      payout, consUnits, consPayout,
      mainDividend: g.main.length === 1 ? g.main[0]?.dividend ?? null : null,
      consolationDividend: g.cons.length === 1 ? g.cons[0]?.dividend ?? null : null,
      missing, pendingWithdrawal, pendingSettlement: missing && !pendingWithdrawal && original.every(Boolean),
      detail: missing ? detail.map(d => ({ ...d, hit: null })) : detail });
  }
  return out.sort((a, b) => (a.races[0] ?? 0) - (b.races[0] ?? 0));
}

async function loadLegs(date: string): Promise<{ legs: Record<number, Leg>; venue: string | null; races?: PoolEvidenceRace[]; noArchive?: boolean }> {
  const res = await fetch(`/api/public/frozen-racing?date=${encodeURIComponent(date)}`, { signal: AbortSignal.timeout(25_000), cache: 'no-store' });
  // 該日從未建立原始凍結存證：唔係讀取失敗，跨場一律列「缺預測」、不入正式合計
  if (res.status === 503) {
    const body = await res.clone().json().catch(() => null) as { reason?: string } | null;
    if (body?.reason === 'no-archive') return { legs: {}, venue: null, noArchive: true };
  }
  if (!res.ok) throw new Error('原始凍結未能核實，跨場原注暫停結算');
  const frozen = await res.json() as { date: string; venue: string; source: string; races: PoolEvidenceRace[] };
  if (frozen.date !== date || frozen.source !== 'verified-original-snapshot' || !['ST','HV'].includes(frozen.venue) || !Array.isArray(frozen.races)) throw new Error('跨場原注來源未能核實');
  return { legs: frozenPoolLegs(frozen.races), venue: frozen.venue, races: frozen.races };
}

export const exoticPoolOptions = (date: string) => queryOptions({
  queryKey: ["exotic-trio-verified-original", date], enabled: !!date, staleTime: 30_000,
  queryFn: async () => {
    const { legs, venue, noArchive, races } = await loadLegs(date);
    // 無原注可核對就唔再讀其他來源，避免無關網絡失敗蓋過「無存證」。
    if (noArchive) return { pools: [] as PoolCalc[], legs, favourites: {} as Record<number, number[] | undefined>, evidence: {} as Record<number, OfficialFavourites>, venue, noArchive: true };
    const [divs, changes] = await Promise.all([fetchRaceDividends(date), getHkjcChanges({ data: { date } })]);
    const withdrawn: Record<number, Set<number>> = {};
    for (const c of changes?.changes ?? []) {
      if (c.kind !== "scratched" && c.kind !== "replaced") continue;
      const pick = races?.find(r=>r.raceNumber===c.raceNumber)?.picks.find(p=>p.horseNumber===c.horseNumber);
      if (!pick || !officialWithdrawal([c],c.raceNumber,c.horseNumber,pick.nameCh,pick.horseId)) continue;
      (withdrawn[c.raceNumber] ??= new Set()).add(c.horseNumber);
    }
    // 官方熱門只可以用已存證嘅官方賽果賠率；讀唔到或缺存證嘅場次一律列待核
    const favourites: Record<number, number[] | undefined> = {};
    const evidence: Record<number, OfficialFavourites> = {};
    if (venue) {
      const fav = await getOfficialFavourites({ data: { date, venue } }).catch(() => null);
      for (const r of fav?.races ?? []) {
        evidence[r.raceNumber] = r;
        favourites[r.raceNumber] = favouriteOrderForSettlement(r) ?? undefined;
      }
    }
    return { pools: calcPools(divs, legs, withdrawn, favourites), legs, favourites, evidence, venue, noArchive: !!noArchive };
  },
});

export const SINGLE_POOLS = [
  { key: "FF", name: "四連環", cost: 10 },
  { key: "TRIO", name: "單T", cost: 40 },
  { key: "TIERCE", name: "三重彩", cost: 240 },
  { key: "QUARTET", name: "四重彩", cost: 240 },
];
export function singlePoolKey(pool: string) {
  return ({ 四連環: "FF", F_F: "FF", 單T: "TRIO", 三重彩: "TIERCE", TRI: "TIERCE", 四重彩: "QUARTET", FCT: "QUARTET" } as Record<string, string>)[pool];
}
export function winningSingleDividends(rows: DividendRow[], top4: number[]) {
  if (top4.length !== 4) return [];
  return rows.filter((d) => {
    const key = singlePoolKey(d.pool);
    if (!key) return false;
    const nums = [...setOf(d.combo)];
    const count = key === "FF" || key === "QUARTET" ? 4 : 3;
    return nums.length >= count && nums.filter((n) => top4.includes(n)).length >= count;
  });
}
