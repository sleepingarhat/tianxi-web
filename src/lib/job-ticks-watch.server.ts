/**
 * Job-tick dead-man read side. Heartbeat staleness only proves the cron/job
 * stopped running — a fail-status tick is still a fresh heartbeat (the job is
 * alive), and per-run failures keep using the dividends alert chain
 * (updateDividendAlert), so no duplicate alerts here.
 *
 * Alert state shares the `alert:*` keys of telegramAlert.server, so heartbeat
 * failures surface in the health page "告警紀錄" automatically. Dedupe 12h,
 * recovery notice within 24h — same semantics as runAlertChecks.
 */
import { isJobTickStale, JOB_TICK_WATCHES, jobTickKey, parseJobTick, type JobTickPayload } from './job-ticks';

const DEDUPE_MS = 12 * 60 * 60_000;
const RECOVERY_MS = 24 * 60 * 60_000;

export type JobTickCheck = { key: string; label: string; fail: string | null; at: string | null };

export function jobTickCheck(
  raw: unknown,
  watch: { job: string; label: string; maxAgeMs: number },
  now = new Date(),
): JobTickCheck {
  const key = jobTickKey(watch.job);
  const tick = parseJobTick(raw);
  if (!tick) return { key, label: watch.label, fail: `${watch.label}心跳：從未寫入或無法解析`, at: null };
  const atMs = Date.parse(tick.at);
  if (!Number.isFinite(atMs) || now.getTime() - atMs > watch.maxAgeMs) {
    const mins = Number.isFinite(atMs) ? Math.round((now.getTime() - atMs) / 60_000) : null;
    return {
      key,
      label: watch.label,
      fail: `${watch.label}心跳停滯${mins == null ? '' : ` ${mins} 分鐘`}無運行（最後心跳 ${tick.at}）`,
      at: tick.at,
    };
  }
  // ok 或 fail 都證明工作剛剛運行過；fail 細節由 dividends 告警鏈負責。
  return { key, label: watch.label, fail: null, at: tick.at };
}

export type JobTickAlertStore = {
  read: (key: string) => Promise<unknown>;
  write: (key: string, value: unknown) => Promise<void>;
  send: (text: string) => Promise<{ sent: boolean }>;
};

type AlertValue = { fail: string | null; sent_at: string | null };

function readAlertValue(value: unknown): AlertValue {
  if (!value || typeof value !== 'object') return { fail: null, sent_at: null };
  const r = value as Record<string, unknown>;
  return {
    fail: typeof r['fail'] === 'string' ? r['fail'] : null,
    sent_at: typeof r['sent_at'] === 'string' ? r['sent_at'] : null,
  };
}

export async function runJobTickAlertsWith(
  store: JobTickAlertStore,
  now = new Date(),
): Promise<{ checked: number; failing: string[]; sent: boolean }> {
  const checks = await Promise.all(
    JOB_TICK_WATCHES.map(async w => jobTickCheck(await store.read(jobTickKey(w.job)).catch(() => null), w, now)),
  );
  const failing = checks.filter(c => c.fail);
  const out = { checked: checks.length, failing: failing.map(c => c.fail as string), sent: false };
  const prev = new Map<string, AlertValue>();
  for (const c of checks) {
    prev.set(c.key, readAlertValue(await store.read(`alert:${c.key}`).catch(() => null)));
  }

  const messages: string[] = [];
  const nowIso = now.toISOString();
  const upserts: { key: string; value: AlertValue }[] = [];
  const clears: { key: string; value: AlertValue }[] = [];
  for (const c of failing) {
    const p = prev.get(c.key)!;
    const lastSent = p.sent_at ? Date.parse(p.sent_at) : 0;
    const due = !p.sent_at || !Number.isFinite(lastSent) || now.getTime() - lastSent >= DEDUPE_MS;
    if (due) messages.push(`🚨 ${c.fail}`);
    upserts.push({ key: `alert:${c.key}`, value: { fail: c.fail, sent_at: due ? nowIso : p.sent_at } });
  }
  for (const c of checks.filter(x => !x.fail)) {
    const p = prev.get(c.key)!;
    const lastSent = p.sent_at ? Date.parse(p.sent_at) : 0;
    if (p.fail && p.sent_at && Number.isFinite(lastSent) && now.getTime() - lastSent <= RECOVERY_MS) {
      messages.push(`✅ 已恢復 ${c.label}心跳（之前：${p.fail}）`);
    }
    // Passing always clears state (same as telegramAlert.server), even if the
    // recovery notice fails to send — the health page must not stay stuck.
    if (p.fail || p.sent_at) clears.push({ key: `alert:${c.key}`, value: { fail: null, sent_at: null } });
  }

  if (messages.length) {
    const nowHk = new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 16).replace('T', ' ');
    const sent = await store.send(`天喜工作心跳告警（${nowHk} 香港時間）\n\n${messages.join('\n')}`);
    out.sent = sent.sent;
  }
  // Unsuccessful delivery keeps the old sent_at, so the next run retries.
  if (out.sent || !messages.some(m => m.startsWith('🚨'))) {
    for (const u of upserts) await store.write(u.key, u.value).catch(() => undefined);
  }
  for (const u of clears) await store.write(u.key, u.value).catch(() => undefined);
  return out;
}

export async function runJobTickAlerts(): Promise<{ checked: number; failing: string[]; sent: boolean; detail?: string }> {
  try {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { sendTelegramAlert } = await import('./telegramAlert.server');
    const store: JobTickAlertStore = {
      read: async key => {
        const r = await supabaseAdmin.from('telegram_alert_state').select('value').eq('key', key).maybeSingle();
        if (r.error) throw new Error('tick-state-unreadable');
        return r.data?.value ?? null;
      },
      write: async (key, value) => {
        const r = await supabaseAdmin.from('telegram_alert_state').upsert({ key, value: value as never });
        if (r.error) throw new Error('tick-state-save-failed');
      },
      send: text => sendTelegramAlert(text),
    };
    return await runJobTickAlertsWith(store);
  } catch (error) {
    console.error('job-tick-alerts', error);
    return { checked: 0, failing: [], sent: false, detail: String(error).slice(0, 160) };
  }
}
