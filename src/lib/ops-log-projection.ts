import { isArchivedProductEvent } from './product-scope';

export type OpsHistoryRow = {
  kind: string; severity: string; source: string; message: string; occurred_at: string;
  gate_key?: string | null; gate_status?: string | null; model_version?: string | null;
};
export type CurrentCheck = { id?: string; key?: string; status?: string; detail?: string; note?: string };

/** Event history is evidence, not an active incident list. Never mutate archived rows. */
export function currentOpsHistory(rows: OpsHistoryRow[], checks: CurrentCheck[], now: number) {
  const hkDay = (time: number) => new Date(time + 8 * 3600_000).toISOString().slice(0, 10);
  const liveKeys = new Set(checks.map(c => c.key ?? c.id).filter(Boolean));
  const latest = new Set<string>();
  return [...rows].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).filter(row => {
    if (isArchivedProductEvent(row.source, row.message) || /^(Error: aborted|AbortError)/.test(row.message)) return false;
    if (row.kind === 'model_gate') {
      const key = `${row.source}:${row.model_version ?? ''}:${row.gate_key ?? ''}`;
      if (latest.has(key)) return false;
      latest.add(key);
      // Current checks replace historical gate observations, including PASS recovery.
      return !liveKeys.has(row.gate_key ?? '') && row.gate_status !== 'PASS' && row.severity !== 'info';
    }
    const at = Date.parse(row.occurred_at);
    return Number.isFinite(at) && at <= now && hkDay(at) === hkDay(now) && row.severity !== 'info';
  });
}

export function isInactiveOddsAlert(message: string, checks: CurrentCheck[]) {
  return /賠率已停更新|盤口.*(?:過期|停更新)/.test(message) && checks.some(check =>
    (check.key ?? check.id) === 'display_odds_freshness' && check.status?.toUpperCase() === 'PASS'
    && /非本地賽日投注窗口或已全日開跑/.test(check.note ?? check.detail ?? ''),
  );
}