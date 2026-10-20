import { queryOptions } from "@tanstack/react-query";
import { fetchRaceDividends, type DividendRow } from "./raceDividends";
import { frozenPoolLegs, type FrozenPoolRace, type FrozenPoolLeg } from "./frozen-pool-legs";
import { settleWithdrawnLeg } from "./exotic-withdrawal";
import { getOfficialFavourites } from "./official-favourites.functions";
import { favouriteOrderForSettlement, type OfficialFavourites } from "./official-favourites";
import { getHkjcChanges } from "./hkjc-changes.functions";

const UNIT = 10;

type Leg = FrozenPoolLeg | null;
export type PoolCalc = {
  name: string; races: number[]; units: number; cost: number;
  mainHit: boolean; payout: number; consUnits: number; consPayout: number;
  missing: boolean; pendingWithdrawal: boolean; detail: { race: number; hit: boolean | null }[];
};

const parseLeg = (s: string) => s.trim();
const isAny = (s: string) => s === "任何組合" || s === "F";
const setOf = (s: string) => new Set(s.split(",").map((x) => Number(x.trim())).filter(Number.isFinite));

function legHit(leg: Leg | undefined, part: string | undefined): boolean | null {
  if (!leg) return null;
  if (!part) return null;
  if (isAny(part)) return true;
  const win = setOf(part);
  if (win.size < 3) return false;
  return leg.bankers.every((b) => win.has(b)) && leg.legs.some((x) => win.has(x));
}

export function calcPools(divs: DividendRow[], legsByRace: Record<number, Leg>, withdrawnByRace: Record<number, Set<number>> = {}, favouritesByRace: Record<number, number[] | undefined> = {}): PoolCalc[] {
  const groups = new Map<string, { main?: DividendRow; cons?: DividendRow }>();
  for (const d of divs) {
    if (!/孖T|三T/.test(d.pool)) continue;
    const base = d.pool.replace(/\(安慰獎\)|（安慰獎）/, "").trim();
    const g = groups.get(base) ?? {};
    if (/安慰獎/.test(d.pool)) g.cons = d; else g.main = d;
    groups.set(base, g);
  }
  const out: PoolCalc[] = [];
  for (const [name, g] of groups) {
    const ref = g.main ?? g.cons;
    if (!ref) continue;
    const n = ref.combo.split("/").length;
    const races = Array.from({ length: n }, (_, i) => ref.race_no - n + 1 + i);
    let pendingWithdrawal = false;
    const legs: Leg[] = races.map((r) => {
      const leg = legsByRace[r] ?? null;
      if (!leg) return null;
      const s = settleWithdrawnLeg(leg, withdrawnByRace[r] ?? new Set(), favouritesByRace[r]);
      if (s.status === "pending") { pendingWithdrawal = true; return leg; }
      return { ...leg, ...s.leg };
    });
    // 原票有退出而缺官方熱門證據：成本、派彩一律待核，唔入合計
    const missing = pendingWithdrawal || legs.some((l) => !l);
    const units = legs.reduce((a, leg) => a * (leg?.legs.length ?? 0), 1);
    const mainParts = g.main ? g.main.combo.split("/").map(parseLeg) : [];
    const detail = races.map((r, i) => ({ race: r, hit: !missing && g.main ? legHit(legs[i], mainParts[i]) : null }));
    const mainHit = !missing && !!g.main && detail.every((d) => d.hit);
    let consUnits = 0;
    if (g.cons && !missing) {
      const parts = g.cons.combo.split("/").map(parseLeg);
      const fixedOk = parts.every((p, i) => isAny(p) || legHit(legs[i], p));
      if (fixedOk) {
        // 「任何組合」段：拖腳 3 組之中除咗正獎嗰組，其餘都屬安慰獎
        consUnits = parts.reduce((acc, p, i) => {
          if (!isAny(p)) return acc * (legs[i]?.legs.filter((x) => setOf(p).has(x)).length ?? 0);
          const hitThis = mainParts[i] ? legHit(legs[i], mainParts[i]) : false;
          const won = hitThis ? legs[i]?.legs.filter((x) => setOf(mainParts[i] ?? "").has(x)).length ?? 0 : 0;
          return acc * ((legs[i]?.legs.length ?? 0) - won);
        }, 1);
      }
    }
    out.push({
      name, races, units, cost: units * UNIT,
      mainHit, payout: mainHit && g.main ? legs.reduce((a, leg, i) => a * (leg?.legs.filter((x) => setOf(mainParts[i] ?? "").has(x)).length ?? 0), 1) * g.main.dividend : 0,
      consUnits, consPayout: g.cons ? consUnits * g.cons.dividend : 0,
      missing, pendingWithdrawal, detail,
    });
  }
  return out.sort((a, b) => (a.races[0] ?? 0) - (b.races[0] ?? 0));
}

async function loadLegs(date: string): Promise<{ legs: Record<number, Leg>; venue: string | null }> {
  const res = await fetch(`/api/public/frozen-racing?date=${encodeURIComponent(date)}`, { signal: AbortSignal.timeout(25_000), cache: 'no-store' });
  if (!res.ok) throw new Error('原始凍結未能核實，跨場原注暫停結算');
  const frozen = await res.json() as { date: string; venue: string; source: string; races: FrozenPoolRace[] };
  if (frozen.date !== date || frozen.source !== 'verified-original-snapshot' || !['ST','HV'].includes(frozen.venue) || !Array.isArray(frozen.races)) throw new Error('跨場原注來源未能核實');
  return { legs: frozenPoolLegs(frozen.races), venue: frozen.venue };
}

export const exoticPoolOptions = (date: string) => queryOptions({
  queryKey: ["exotic-trio-verified-original", date], enabled: !!date, staleTime: 30_000,
  queryFn: async () => {
    const [divs, { legs, venue }, changes] = await Promise.all([fetchRaceDividends(date), loadLegs(date), getHkjcChanges({ data: { date } })]);
    const withdrawn: Record<number, Set<number>> = {};
    for (const c of changes?.changes ?? []) {
      if (c.kind !== "scratched" && c.kind !== "replaced") continue;
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
    return { pools: calcPools(divs, legs, withdrawn, favourites), legs, favourites, evidence, venue };
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
