export function validRacingDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error("日期無效");
  return value;
}
export function predictionTiming(generated: string | null, date: string, startTime?: string | null) {
  if (!generated) return "missing";
  const time = Date.parse(generated);
  if (!Number.isFinite(time)) return "unverified";
  const kickoff = startTime && /^\d{2}:\d{2}(:\d{2})?$/.test(startTime) ? Date.parse(`${date}T${startTime.length === 5 ? startTime + ':00' : startTime}+08:00`) : startTime && /(?:Z|[+-]\d{2}:\d{2})$/.test(startTime) ? Date.parse(startTime) : NaN;
  return time >= (Number.isFinite(kickoff) ? kickoff : Date.parse(`${date}T00:00:00+08:00`) + 86_400_000) ? "post_race" : "unverified";
}
export type EloSnapshot = { id: string; entityType: string; entityId: string; name: string; date: string; rating: number; season: number; computedAt: string };
export function parseSnapshot(snapshot: EloSnapshot) {
  const match = /\|overall\|(\d{4}-\d{2}-\d{2})\|(ST|HV)\|(\d+)$/.exec(snapshot.id);
  if (!match || match[1] !== snapshot.date || !match[2] || !match[3]) throw new Error("Elo來源事件格式未能核對");
  return { ...snapshot, venue: match[2], sourceRace: Number(match[3]) };
}
export function snapshotChanges(snapshots: EloSnapshot[]) {
  const rows = snapshots.map(parseSnapshot).sort((a, b) => a.date.localeCompare(b.date) || a.venue.localeCompare(b.venue) || a.sourceRace - b.sourceRace || a.id.localeCompare(b.id));
  const previous = new Map<string, number>();
  return rows.map(row => {
    const key = `${row.entityType}:${row.entityId}`;
    const before = previous.get(key) ?? null;
    previous.set(key, row.rating);
    return { ...row, before, delta: before === null ? null : row.rating - before };
  });
}