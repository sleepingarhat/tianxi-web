/** Freeze-critical GitHub workflows that Lovable Cloud triggers on time; GitHub's own cron stays as backup. */
export const DISPATCH_WORKFLOWS = [
  'capy_entries.yml',
  'capy_d1_sync_entries.yml',
  'capy_racecard.yml',
  'backend_lgb_predict_upcoming.yml',
  'backend_lgb_fast_predict.yml',
  'tg_notify_prerace.yml',
  'capy_d1_sync.yml',
  'elo-post-race.yml',
  'capy_integrity_audit.yml',
] as const;
export type DispatchWorkflow = (typeof DISPATCH_WORKFLOWS)[number];

export const isDispatchWorkflow = (w: unknown): w is DispatchWorkflow =>
  typeof w === 'string' && (DISPATCH_WORKFLOWS as readonly string[]).includes(w);

/** Skip only when a run started recently and has not failed (GitHub's schedule already fired on time). */
export function shouldDispatch(latest: { created_at: string; status: string; conclusion: string | null } | null, nowMs: number, windowMin = 20) {
  if (!latest) return true;
  // A long-running training/collection job must not be duplicated just because it is older than the grace window.
  if (latest.status !== 'completed') return false;
  const ageMin = (nowMs - Date.parse(latest.created_at)) / 60_000;
  if (!Number.isFinite(ageMin) || ageMin < 0) return false;
  if (!(ageMin >= 0 && ageMin < windowMin)) return true;
  return latest.conclusion !== 'success' && latest.conclusion !== 'skipped' ? true : latest.conclusion === 'skipped';
}
