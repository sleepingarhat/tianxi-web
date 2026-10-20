/**
 * 賽事更改簡化規則（2026-10-21）：
 * - 鎖前更改：應先更新排位並重算該場；若凍結仍含鎖前已退出馬（系統未能重算），按鎖後退出方式計：退出馬當冇中，分母照4。
 * - 鎖後退出／未完賽：保留原四揀，唔補位；退出馬只標無效，命中照計「中幾匹／4」。
 * - 公布時間未能核實：待核，不計分。
 */
export type RankedPick = { horseNumber: number; rank: number; withdrawn?: boolean; announcedAtIso?: string | null | undefined };

export function effectiveTop4<T extends RankedPick>(picks: T[], lockAt?: string | null) {
  const ordered = picks.filter(p => Number.isFinite(p.rank)).sort((a, b) => a.rank - b.rank);
  const original = ordered.slice(0, 4).map(p => p.horseNumber);
  const withdrawals = ordered.filter(p => p.withdrawn);
  const lockTime = Date.parse(lockAt ?? '');
  const beforeLock = withdrawals.some(p => Number.isFinite(lockTime) && Number.isFinite(Date.parse(p.announcedAtIso ?? '')) && Date.parse(p.announcedAtIso ?? '') <= lockTime);
  const unknown = withdrawals.some(p => !Number.isFinite(lockTime) || !Number.isFinite(Date.parse(p.announcedAtIso ?? '')));
  const withdrawn = original.filter(n => withdrawals.some(p => p.horseNumber === n));
  const valid = original.filter(n => !withdrawn.includes(n));
  const status = unknown && !beforeLock ? 'unverified-change-timing' as const : 'valid' as const;
  return { original, valid, withdrawn, status, prelockNotRecomputed: beforeLock };
}
