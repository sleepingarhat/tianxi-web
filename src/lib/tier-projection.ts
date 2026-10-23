import { tierHas, type Tier } from "./tiers";

/** Presentation projections never alter original inputs or archived records. */
export function cardAccess(tier: Tier, raceNumber: number): "full" | "name" | "locked" {
  return raceNumber === 1 || tier === "pro" ? "full" : tier === "registered" ? "name" : "locked";
}
export function projectCardPicks<T extends { nameCh?: string }>(picks: readonly T[], tier: Tier, raceNumber: number) {
  const access = cardAccess(tier, raceNumber);
  if (access === "locked") return [];
  if (access === "name") return picks.slice(0, 1).map(p => ({ nameCh: p.nameCh }));
  return [...picks];
}
export function projectRacePicks<T>(picks: readonly T[], tier: Tier): T[] {
  return [...picks].slice(0, tier === "pro" ? picks.length : 1);
}
export function predictorAllowed(tier: Tier, raceNumber: number): boolean {
  return tier === "pro" || (tier === "registered" && raceNumber === 1);
}
export function projectMemberRows<T>(rows: readonly T[], tier: Tier): T[] {
  return tierHas(tier, "registered") ? [...rows] : rows.slice(0, 20);
}
export function projectMeetingDates<T extends { date: string }>(rows: readonly T[], tier: Tier, today: string): T[] {
  const past = [...rows].filter(r => r.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  return tierHas(tier, "registered") ? [...rows] : past.slice(0, 1);
}
export function explainTier(date: string, today: string, resultsFinal: boolean): "registered" | "pro" {
  return date >= today && !resultsFinal ? "pro" : "registered";
}