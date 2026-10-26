/**
 * Job heartbeat helpers — healthchecks "expected by T" / jeffincn poll_ticks,
 * rewritten for Tianxi (Supabase telegram_alert_state or any key/value store).
 *
 * No SaaS. Callers persist JobTickPayload under a stable key such as
 * `job_tick:racing-dividends`. Content-hash dedupe for dividends already lives
 * in hkjc-dividends (source_sha256); this module covers the orthogonal case:
 * the cron stopped firing or the job hung before writing anything.
 */

export type JobTickPayload = {
  job: string;
  status: 'ok' | 'fail';
  at: string; // ISO-8601 UTC
  meta?: Record<string, string | number | boolean | null>;
};

export const LOCAL_VENUES = new Set(['ST', 'HV']);

/** jeffincn LOCAL_VENUES filter — skip overseas simulcast meeting keys. */
export function isLocalVenue(venue: string | null | undefined): boolean {
  const v = (venue || '').trim().toUpperCase();
  return LOCAL_VENUES.has(v);
}

export function jobTickKey(job: string): string {
  return `job_tick:${job}`;
}

export function makeJobTick(
  job: string,
  status: 'ok' | 'fail',
  meta: JobTickPayload['meta'] = {},
  now = new Date(),
): JobTickPayload {
  return {
    job,
    status,
    at: now.toISOString(),
    meta: meta ?? {},
  };
}

export function parseJobTick(value: unknown): JobTickPayload | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.job !== 'string' || (v.status !== 'ok' && v.status !== 'fail')) return null;
  if (typeof v.at !== 'string') return null;
  return {
    job: v.job,
    status: v.status,
    at: v.at,
    meta: (v.meta && typeof v.meta === 'object' ? (v.meta as JobTickPayload['meta']) : {}) ?? {},
  };
}

/**
 * Dead-man: true when tick missing, unparseable, status=fail, or older than maxAgeMs.
 */
export function isJobTickStale(
  tick: JobTickPayload | null | undefined,
  maxAgeMs: number,
  now = new Date(),
): boolean {
  if (!tick) return true;
  if (tick.status === 'fail') return true;
  const at = Date.parse(tick.at);
  if (!Number.isFinite(at)) return true;
  return now.getTime() - at > maxAgeMs;
}
