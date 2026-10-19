export type RunnerIdentity = { raceNumber: number; horseNumber: number; horseId: string };

export function identityMatchedEntry(horseId: string | undefined, entry: { horseId?: string; id?: string } | undefined) {
  return horseId && (entry?.horseId ?? entry?.id) === horseId ? entry : undefined;
}

export function evidenceDraw(frozen: boolean, original: number | null | undefined, current: number | null | undefined) {
  return frozen ? original ?? null : original ?? current ?? null;
}

/** Read-only cross-check, not a repair or proof of pre-lock provenance. */
export function verifyRunnerIdentities(frozen: RunnerIdentity[], card: RunnerIdentity[], results: RunnerIdentity[]) {
  const key = (r: RunnerIdentity) => `${r.raceNumber}:${r.horseNumber}`;
  const index = new Map<string, string>();
  const horses = new Set<string>();
  for (const r of card) {
    if (!Number.isInteger(r.raceNumber) || r.raceNumber < 1 || !Number.isInteger(r.horseNumber) || r.horseNumber < 1 || !r.horseId || index.has(key(r)) || horses.has(`${r.raceNumber}:${r.horseId}`)) {
      throw new Error('排位身份重複或不完整，暫停提供最終預測');
    }
    index.set(key(r), r.horseId);
    horses.add(`${r.raceNumber}:${r.horseId}`);
  }
  for (const r of frozen) {
    const id = index.get(key(r));
    if (!id) throw new Error(`第${r.raceNumber}場${r.horseNumber}號缺排位身份證據，暫停提供最終預測`);
    if (id !== r.horseId) throw new Error(`第${r.raceNumber}場${r.horseNumber}號凍結馬匹與排位身份不一致，暫停提供最終預測`);
  }
  const original = new Map(frozen.map(r => [key(r), r.horseId]));
  const resultNumbers = new Set<string>();
  for (const r of results) {
    if (!r.horseId || !Number.isInteger(r.horseNumber) || r.horseNumber < 1 || resultNumbers.has(key(r)) || original.get(key(r)) !== r.horseId) {
      throw new Error(`第${r.raceNumber}場官方賽果與凍結身份未能核實，暫停提供最終預測`);
    }
    resultNumbers.add(key(r));
  }
  return { status: 'matched-current-card-and-available-results' as const, runners: frozen.length };
}