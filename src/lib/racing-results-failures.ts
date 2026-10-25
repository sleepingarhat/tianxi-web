/**
 * Per-race isolation + deduped alerts for the results completion-check job.
 * One race that cannot be archived must not block later races or the
 * meeting-completion dispatch; it stays unarchived, so delivery can never be
 * marked verified (resultsDeliveryVerified needs every race) and the original
 * freeze is never touched.
 */

export type RaceFailure = { date: string; venue: string; raceNumber: number; code: string };
export type RaceAttempt = { raceNumber: number; action: string; sha256?: string };

/** Stable, secret-free error code: our own kebab-case codes pass through, anything else collapses. */
export function resultErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/^[a-z0-9][a-z0-9-]{0,79}$/.test(message)) return message;
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError") return "official-result-timeout";
  return "unexpected-error";
}

/**
 * Try pending races lowest-first. A failing or lease-held race is recorded and
 * skipped; stop after the first newly archived race (same pacing as before) or
 * after maxAttempts fetches so a tick stays bounded.
 */
export async function collectPendingRaces(
  date: string,
  venue: string,
  pending: number[],
  collect: (raceNumber: number) => Promise<RaceAttempt>,
  maxAttempts = 4,
): Promise<{ archived: RaceAttempt | null; attempts: RaceAttempt[]; failures: RaceFailure[] }> {
  const attempts: RaceAttempt[] = [];
  const failures: RaceFailure[] = [];
  for (const raceNumber of [...pending].sort((a, b) => a - b).slice(0, maxAttempts)) {
    try {
      const result = await collect(raceNumber);
      attempts.push(result);
      if (result.action !== "lease-active") return { archived: result, attempts, failures };
    } catch (error) {
      failures.push({ date, venue, raceNumber, code: resultErrorCode(error) });
    }
  }
  return { archived: null, attempts, failures };
}

export const raceFailureAlertKey = (f: RaceFailure) =>
  `results-race-failure:${f.date}:${f.venue}:R${f.raceNumber}:${f.code}`;

/** HKJC's result table appears shortly after the off; parse gaps inside this window are expected, not incidents. */
export const EARLY_RESULT_GRACE_MS = 20 * 60_000;

/** Parse an ISO timestamp or "HH:mm"/"HH:mm:ss" (HKT) into epoch ms for the given race date. */
export function raceStartedAt(startTime: string | null | undefined, date: string): number | null {
  if (!startTime) return null;
  const iso = Date.parse(startTime);
  if (Number.isFinite(iso)) return iso;
  const m = startTime.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  const [, hh, mm] = m ?? [];
  if (!hh || !mm || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return Date.parse(`${date}T${hh.padStart(2, "0")}:${mm}:00+08:00`);
}

/**
 * Noise control: right after the off, HKJC's result table is legitimately
 * absent or incomplete, and before race 1 no result can exist at all. Suppress
 * only those known-transient alerts; every other failure still alerts.
 * startedMap: raceNumber → started epoch ms; null = timing unknown (never suppress).
 */
export function suppressRaceFailureAlert(
  f: RaceFailure,
  startedMap: ReadonlyMap<number, number> | null,
  now = new Date(),
): boolean {
  if (!startedMap) return false;
  if (f.code === "official-result-timeout") return startedMap.size === 0;
  if (f.code === "official-result-table-missing" || f.code === "official-result-columns-incomplete") {
    const started = startedMap.get(f.raceNumber);
    return started != null && now.getTime() - started < EARLY_RESULT_GRACE_MS;
  }
  return false;
}

export const raceFailureAlertText = (f: RaceFailure) =>
  `⚠️ 賽果收料失敗：${f.date} ${f.venue} 第${f.raceNumber}場（${f.code}）；已跳過此場繼續後續場次，此賽日不會標記為已核實，原凍結不改。可於修正後補收：archive-backfill ${f.date} ${f.venue} R${f.raceNumber}。`;

export type AlertStore = {
  read: (key: string) => Promise<{ sentAt?: string } | null>;
  write: (key: string, value: Record<string, unknown>) => Promise<void>;
  send: (text: string) => Promise<{ sent: boolean }>;
};

/**
 * Alert once per key. Dedupe is recorded only after delivery (failed sends
 * retry next tick). If the state store is unreadable we still alert: losing an
 * alert is worse than a duplicate.
 */
export async function alertOnce(
  key: string,
  text: string,
  store: AlertStore,
  now = new Date(),
): Promise<"sent" | "deduped" | "send-failed"> {
  const previous = await store.read(key).catch(() => null);
  if (previous?.sentAt) return "deduped";
  const result = await store.send(text).catch(() => ({ sent: false }));
  if (!result.sent) return "send-failed";
  await store.write(key, { sentAt: now.toISOString() }).catch(() => undefined);
  return "sent";
}
