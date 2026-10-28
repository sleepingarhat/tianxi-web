import { isArchivedProductEvent } from './product-scope';

export type OpsHistoryRow = {
  kind: string; severity: string; source: string; message: string; occurred_at: string;
  gate_key?: string | null; gate_status?: string | null; model_version?: string | null;
};
export type CurrentCheck = { id?: string; key?: string; status?: string; detail?: string; note?: string };

export type OpsLog = { kind: string; level: 'fail' | 'warn' | 'ok'; source: string; message: string; at: string | null };
type Alert = { message?: string; msg?: string; title?: string; severity?: string; level?: string; source?: string; key?: string; created_at?: string; at?: string };
type Workflow = { state: string; label: string; file: string; conclusion?: string | null; startedAt: string | null };
export function projectCurrentOps(input: {
  history: OpsHistoryRow[]; checks: (CurrentCheck & { label?: string })[];
  alerts: Alert[]; workflows: Workflow[];
  telegram: { key: string; fail: string; sentAt: string | null }[];
  readErrors: { source: string; message: string }[]; now: number; showOk?: boolean;
}): OpsLog[] {
  const logs: OpsLog[] = currentOpsHistory(input.history, input.checks, input.now).map(event => ({
    kind: event.kind === 'model_gate' ? '模型閘歷史' : 'API 錯誤歷史',
    level: event.severity === 'error' ? 'fail' : event.severity === 'warning' ? 'warn' : 'ok',
    source: event.source, message: event.message, at: event.occurred_at,
  }));
  for (const alert of input.alerts) {
    const message = String(alert.message ?? alert.msg ?? alert.title ?? JSON.stringify(alert)).slice(0, 300);
    if (isInactiveOddsAlert(message, input.checks)) continue;
    logs.push({ kind: '資料完整性', level: alert.severity === 'critical' || alert.level === 'error' || alert.level === 'red' ? 'fail' : 'warn', source: alert.source ?? alert.key ?? '後端', message, at: alert.created_at ?? alert.at ?? null });
  }
  for (const workflow of input.workflows) if (workflow.state === 'fail' || input.showOk) logs.push({
    kind: workflow.state === 'fail' ? '定時任務失敗' : '定時任務成功', level: workflow.state === 'fail' ? 'fail' : 'ok',
    source: `賽馬 · ${workflow.label}`, message: `${workflow.file} 結果 ${workflow.conclusion ?? '—'}`, at: workflow.startedAt,
  });
  for (const t of input.telegram) logs.push({ kind: '告警', level: 'warn', source: `Telegram · ${t.key}`, message: t.fail, at: t.sentAt });
  for (const check of input.checks) if (check.status?.toUpperCase() !== 'PASS') logs.push({
    kind: '模型閘', level: check.status?.toUpperCase() === 'FAIL' ? 'fail' : 'warn', source: check.label ?? check.key ?? check.id ?? '引擎', message: check.note ?? check.detail ?? '', at: null,
  });
  for (const error of input.readErrors) logs.push({ kind: 'API 錯誤', level: 'fail', source: error.source, message: error.message, at: new Date(input.now).toISOString() });
  return logs.filter(log => !isArchivedProductEvent(log.source, log.message)).sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
}

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