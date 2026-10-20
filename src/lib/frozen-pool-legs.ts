/** Cross-race tickets use only the first five original, verified frozen ranks. */
export type FrozenPoolLeg = { race: number; bankers: number[]; legs: number[]; fifthFromLive: false };
export type FrozenPoolRace = {
  raceNumber: number;
  metricInput: { status: string };
  picks: { horseNumber: number; rank: number }[];
};
export function frozenPoolLegs(races: FrozenPoolRace[]): Record<number, FrozenPoolLeg | null> {
  return Object.fromEntries(races.map(r => {
    const picks = [...r.picks].sort((a, b) => a.rank - b.rank).slice(0, 5);
    if (r.metricInput.status !== 'valid' || picks.length !== 5 ||
      picks.some((p, i) => p.rank !== i + 1 || !Number.isInteger(p.horseNumber) || p.horseNumber <= 0) ||
      new Set(picks.map(p => p.horseNumber)).size !== 5) return [r.raceNumber, null];
    return [r.raceNumber, { race: r.raceNumber, bankers: picks.slice(0, 2).map(p => p.horseNumber),
      legs: picks.slice(2).map(p => p.horseNumber), fifthFromLive: false }];
  }));
}