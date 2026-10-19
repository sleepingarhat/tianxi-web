/** A failed read of official changes must never look like "no changes". */
export type ChangesRead<T> = { ok: true; snapshot: T | null } | { ok: false };

export async function readChangesEvidence<T>(read: () => Promise<T | null>): Promise<ChangesRead<T>> {
  try { return { ok: true, snapshot: await read() }; } catch { return { ok: false }; }
}

/** Status for official scoring: read failure blocks the race from KPI instead of passing it. */
export function changesAwareStatus(readOk: boolean, status: string) {
  return readOk ? status : 'unverified-changes-read';
}

/** Pre-lock stale check: an unreadable picks body is unknown, never "already excluded". */
export function staleCheckOutcome(body: unknown, stale: string[]): 'unknown' | 'clean' | 'stale' {
  if (body == null) return 'unknown';
  return stale.length ? 'stale' : 'clean';
}
