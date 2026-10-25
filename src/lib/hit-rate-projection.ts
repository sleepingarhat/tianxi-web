// 對帳回應按會籍分級（純函數，伺服器同測試共用）。訪客：彙總＋第一場完整；第二場起只留賽果，標 redacted。
import type { Tier } from "./tiers";

/* eslint-disable @typescript-eslint/no-explicit-any */
const STRIP = new Set(["predictedTop4", "predictedFifth", "boxPayouts", "scoreSource", "ensembleAlpha", "originalTop4"]);
const isHitKey = (k: string) => /Hit$/.test(k) || /IntersectCount$/.test(k) || k === "hit";

function firstRaceNumber(races: any[]): number | null {
  const nums = races.map(r => Number(r?.raceNumber)).filter(Number.isFinite);
  return nums.length ? Math.min(...nums) : null;
}

export function redactRace(race: any): any {
  const out: any = {};
  for (const [k, v] of Object.entries(race ?? {})) {
    if (STRIP.has(k) || isHitKey(k)) continue;
    out[k] = v;
  }
  if (Array.isArray(race?.actualTop4)) {
    out.actualTop4 = race.actualTop4.map((a: any) => {
      const { hit: _hit, ...rest } = a ?? {};
      return rest;
    });
  }
  out.redacted = true;
  return out;
}

export function projectHitRate<T>(body: T, tier: Tier): T {
  if (tier !== "guest") return body;
  const j: any = body;
  const races: any[] = Array.isArray(j?.races) ? j.races : [];
  const first = firstRaceNumber(races);
  return { ...j, races: races.map(r => (first != null && Number(r?.raceNumber) === first && !r?.redacted ? r : redactRace(r))) };
}

export function projectCoverageAudit<T extends { meetings: { races: any[] }[] }>(audit: T, tier: Tier): T {
  if (tier !== "guest") return audit;
  return {
    ...audit,
    meetings: audit.meetings.map(m => {
      const first = firstRaceNumber(m.races);
      return { ...m, races: m.races.map(r => {
        if (first != null && Number(r?.raceNumber) === first) return r;
        const { predictedTop4: _p, originalTop4: _o, ...rest } = r ?? {};
        return { ...rest, redacted: true };
      }) };
    }),
  };
}

/** 回應係咪包含被隱藏場次（Worker access:"aggregate" 或伺服器分級）。 */
export function hasRedactedRaces(body: any): boolean {
  return body?.access === "aggregate" || (Array.isArray(body?.races) && body.races.some((r: any) => r?.redacted));
}
