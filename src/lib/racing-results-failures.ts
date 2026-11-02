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

/**
 * HKJC fills the result page in stages: the table appears, then the columns
 * complete. These codes are that ramp-up, not an incident, so one race must not
 * produce one alert per code (2026-11-01 HV R6/R8/R10 each alerted twice).
 */
export const TRANSIENT_RESULT_CODES: ReadonlySet<string> = new Set([
  "official-result-table-missing",
  "official-result-columns-incomplete",
  "official-result-race-mismatch",
]);

export const raceFailureAlertKey = (f: RaceFailure) =>
  `results-race-failure:${f.date}:${f.venue}:R${f.raceNumber}:` +
  (TRANSIENT_RESULT_CODES.has(f.code) ? "not-yet-published" : f.code);

/**
 * Grace after the off before a parse gap becomes an alert. Measured on the whole
 * 2026-11-01 HV meeting: every race archived 15.1–20.3 minutes after the off,
 * while the page still reported table-missing / columns-incomplete at +5 to +15
 * minutes. 30 minutes covers that ramp-up with margin; a gap after it is a real
 * incident and alerts once per race.
 */
export const EARLY_RESULT_GRACE_MS = 30 * 60_000;

/** Parse an ISO timestamp or "HH:mm"/"HH:mm:ss" (HKT) into epoch ms for the given race date. */
export function raceStartedAt(startTime: string | null | undefined, date: string): number | null {
  if (!startTime) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(startTime)) {
    const iso = Date.parse(startTime);
    return Number.isFinite(iso) ? iso : null;
  }
  const m = startTime.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  const [, hh, mm] = m ?? [];
  if (!hh || !mm || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (Number(hh) > 23 || Number(mm) > 59) return null;
  const parsed = Date.parse(`${date}T${hh.padStart(2, "0")}:${mm}:00+08:00`);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Preserve future starts; missing/invalid timing is not evidence of a pre-race meeting. */
export function raceStartTimingMap(
  rows: ReadonlyArray<{ raceNumber: number; startTime: string | null }>,
  date: string,
): ReadonlyMap<number, number> | null {
  if (!rows.length) return null;
  const map = new Map<number, number>();
  for (const row of rows) {
    const time = raceStartedAt(row.startTime, date);
    if (time == null || !Number.isFinite(time)) return null;
    map.set(row.raceNumber, time);
  }
  return map;
}

/**
 * Per-race view of the same evidence: keeps every race whose own start time is
 * known instead of discarding the whole meeting because one row is blank. A race
 * missing from the map is never suppressed, so this can only ever mute an alert
 * for a race whose official start time we actually hold.
 */
export function raceStartTimingMapPartial(
  rows: ReadonlyArray<{ raceNumber: number; startTime: string | null }>,
  date: string,
): ReadonlyMap<number, number> | null {
  const map = new Map<number, number>();
  for (const row of rows) {
    const time = raceStartedAt(row.startTime, date);
    if (time != null && Number.isFinite(time)) map.set(row.raceNumber, time);
  }
  return map.size ? map : null;
}

/** Meeting/job timeouts may be muted only with positive evidence that every known start is future. */
export function suppressMeetingTimeoutAlert(
  code: string,
  timing: ReadonlyMap<number, number> | null,
  now = new Date(),
): boolean {
  return code === "official-result-timeout" && timing != null && timing.size > 0 &&
    [...timing.values()].every(time => Number.isFinite(time) && time > now.getTime());
}

/**
 * Noise control: right after the off, HKJC's result page is legitimately not
 * yet updated — the table is absent or incomplete, or the page still shows
 * the previous race (race-mismatch). Archiving still fails closed and retries
 * next tick; only the alert is muted. A RESULT-status race timeout always
 * alerts. startedMap: raceNumber → start epoch ms; null = timing unknown
 * (never suppress).
 */
export function suppressRaceFailureAlert(
  f: RaceFailure,
  startedMap: ReadonlyMap<number, number> | null,
  now = new Date(),
): boolean {
  if (!startedMap) return false;
  if (
    f.code === "official-result-table-missing" ||
    f.code === "official-result-columns-incomplete" ||
    f.code === "official-result-race-mismatch"
  ) {
    const started = startedMap.get(f.raceNumber);
    const elapsed = started == null ? NaN : now.getTime() - started;
    return elapsed >= 0 && elapsed < EARLY_RESULT_GRACE_MS;
  }
  return false;
}

/**
 * Pre-race D1 has no races rows, so start times come from the Worker's public
 * meeting projection (same data the site displays). Venue must match exactly;
 * any missing/invalid time yields null → never suppress.
 */
export function workerMeetingTimingMap(
  payload: { venue?: unknown; races?: unknown } | null,
  date: string,
  venue: string,
): ReadonlyMap<number, number> | null {
  if (!payload || payload.venue !== venue || !Array.isArray(payload.races)) return null;
  const rows: { raceNumber: number; startTime: string | null }[] = [];
  for (const r of payload.races as { raceNumber?: unknown; startTime?: unknown }[]) {
    const raceNumber = Number(r?.raceNumber);
    if (!Number.isInteger(raceNumber) || raceNumber < 1) return null;
    rows.push({ raceNumber, startTime: typeof r?.startTime === "string" ? r.startTime : null });
  }
  return raceStartTimingMap(rows, date);
}

/**
 * Same projection read, tolerant of individual races whose start time is blank.
 * Used for per-race alert suppression, where one blank row must not disable
 * suppression for every other race in the meeting.
 */
export function workerMeetingTimingMapPartial(
  payload: { venue?: unknown; races?: unknown } | null,
  date: string,
  venue: string,
): ReadonlyMap<number, number> | null {
  if (!payload || payload.venue !== venue || !Array.isArray(payload.races)) return null;
  const rows: { raceNumber: number; startTime: string | null }[] = [];
  for (const r of payload.races as { raceNumber?: unknown; startTime?: unknown }[]) {
    const raceNumber = Number(r?.raceNumber);
    if (!Number.isInteger(raceNumber) || raceNumber < 1) continue;
    rows.push({ raceNumber, startTime: typeof r?.startTime === "string" ? r.startTime : null });
  }
  return raceStartTimingMapPartial(rows, date);
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
