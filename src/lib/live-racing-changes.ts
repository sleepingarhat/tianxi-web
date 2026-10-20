import { officialWithdrawal, type HkjcChange } from './hkjc-changes';

/** Overlay official notices only; never change original names, ranks or scores. */
export function liveWithdrawal(changes: HkjcChange[], raceNumber: number, pick: { horseNumber: number; nameCh?: string; horseId?: string }, lockAt?: string | null) {
  const c = officialWithdrawal(changes, raceNumber, pick.horseNumber, pick.nameCh, pick.horseId);
  if (!c) return null;
  const stamp = Date.parse(c.announcedAtIso ?? '');
  const lock = Date.parse(lockAt ?? '');
  return { ...c, beforeLock: Number.isFinite(stamp) && Number.isFinite(lock) ? stamp <= lock : null };
}

export const CHANGES_POLL_MS = 15_000;