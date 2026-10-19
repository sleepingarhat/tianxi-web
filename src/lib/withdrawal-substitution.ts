/** Post-freeze withdrawals: fill the four from the frozen engine order. Never rewrites the frozen ranks. */
export type RankedPick = { horseNumber: number; rank: number; withdrawn?: boolean };

export function effectiveTop4<T extends RankedPick>(picks: T[]) {
  const ordered = picks.filter(p => Number.isFinite(p.rank)).sort((a, b) => a.rank - b.rank);
  const original = ordered.slice(0, 4).map(p => p.horseNumber);
  const effective = ordered.filter(p => !p.withdrawn).slice(0, 4).map(p => p.horseNumber);
  const removed = original.filter(n => !effective.includes(n));
  const added = effective.filter(n => !original.includes(n));
  return { original, effective, removed, added, substituted: added.length > 0 || removed.length > 0 };
}
