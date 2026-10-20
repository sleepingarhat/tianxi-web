import { HKJC_CHANGES_URL, parseHkjcChangesPage } from './hkjc-changes';

/** Fetch the official HKJC changes page once and append an immutable snapshot (deduped by SHA). */
export async function captureHkjcChanges() {
  const res = await fetch(HKJC_CHANGES_URL, { headers: { 'user-agent': 'Mozilla/5.0 tianxi-racing evidence' }, cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return { ok: false as const, error: `馬會更易事項回應 ${res.status}` };
  const raw = await res.text();
  const page = parseHkjcChangesPage(raw);
  if (!page) return { ok: false as const, error: '馬會更易事項格式未能辨認' };
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const sha256 = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { error } = await supabaseAdmin.from('hkjc_changes_snapshots').upsert({ race_date: page.date, venue: page.venue, source_url: HKJC_CHANGES_URL, sha256, changes: page.changes as never, raw_html: raw }, { onConflict: 'race_date,venue,sha256', ignoreDuplicates: true });
  if (error) return { ok: false as const, error: '更易事項存檔失敗' };
  return { ok: true as const, date: page.date, venue: page.venue, sha256, changes: page.changes.length };
}

/** Latest stored snapshot for a meeting (read-only, publishable client). */
export async function readLatestHkjcChanges(date: string) {
  const { createClient } = await import('@supabase/supabase-js');
  const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
  const sb = createClient(process.env['SUPABASE_URL']!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => { const h = new Headers(init?.headers); if (key.startsWith('sb_') && h.get('Authorization') === `Bearer ${key}`) h.delete('Authorization'); h.set('apikey', key); return fetch(input, { ...init, headers: h }); } },
  });
  const { data, error } = await sb.from('hkjc_changes_snapshots').select('race_date,venue,fetched_at,source_url,sha256,changes').eq('race_date', date).order('fetched_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error('馬會更易事項暫時未能讀取');
  return data;
}

const WORKER = 'https://tianxi-backend.tianxi-entertainment.workers.dev';

/**
 * Pre-lock only: if current (unlocked) picks still contain an officially withdrawn horse,
 * refresh the racecard and request a fresh recompute. After lock nothing is recomputed.
 */
export async function recomputeIfStaleBeforeLock(changes: import('./hkjc-changes').HkjcChange[], date: string) {
  const { z } = await import('zod');
  const { advancePrelock } = await import('./prelock-workflow');
  const { supabaseAdmin: sb } = await import('@/integrations/supabase/client.server');
  const lease = crypto.randomUUID();
  const claimed = await sb.rpc('claim_racing_prelock', { _date: date, _token: lease });
  if (claimed.error) throw new Error('退出追蹤狀態未能核實，停止派送');
  if (claimed.data === null) return { action: 'lease-active' as const };
  const stateSchema = z.object({ warned: z.array(z.string()).optional(), recovered: z.array(z.string()).optional(), requestedAt: z.string().optional(), runId: z.number().optional(), phase: z.string().optional(), checkedAt: z.string().optional(), stale: z.array(z.string()).optional(), error: z.string().optional() });
  let state = stateSchema.parse(claimed.data);
  const save = async (next: import('./prelock-workflow').PrelockState, release = false) => {
    const result = await sb.rpc('save_racing_prelock', { _date: date, _token: lease, _state: next as import('@/integrations/supabase/types').Json, _release: release });
    if (result.error || !result.data) throw new Error('退出追蹤工作鎖失效，停止派送');
    state = next;
  };
  const unlocked = async () => {
    const lock = await fetch(`${WORKER}/api/analyze/lock-state`, { cache: 'no-store', signal: AbortSignal.timeout(8_000) }).then(r => r.ok ? r.json() as Promise<{ date?: string; locked?: boolean; edition?: string }> : null).catch(() => null);
    return lock?.date === date && lock.locked === false && lock.edition !== 'final';
  };
  const token = process.env['TIANXI_ADMIN_TOKEN'];
  const picksUrl = `${WORKER}/api/analyze/today-picks`;
  const read = async (fresh: boolean) => {
    if (fresh && !token) return null;
    const r = await fetch(picksUrl + (fresh ? '?fresh=1' : ''), { cache: 'no-store', headers: token ? { authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) return null;
    const body = z.object({ date: z.string(), races: z.array(z.object({ raceNumber: z.number().int().positive(), picks: z.array(z.object({ horseNumber: z.number().int().positive(), nameCh: z.string().min(1) })).min(4) })).min(1) }).safeParse(await r.json());
    if (!body.success || body.data.date !== date) return null;
    return body.data.races.flatMap(r => r.picks.filter(p => officialWithdrawal(changes,r.raceNumber,p.horseNumber,p.nameCh)).map(p => `R${r.raceNumber} #${p.horseNumber} ${p.nameCh}`));
  };
  const { officialWithdrawal } = await import('./hkjc-changes');
  const { sendTelegramAlert } = await import('./telegramAlert.server');
  const gh = process.env['GITHUB_TOKEN'];
  const headers = { authorization: `Bearer ${gh ?? ''}`, accept: 'application/vnd.github+json', 'user-agent': 'tianxi-web' };
  const workflow = 'https://api.github.com/repos/sleepingarhat/tianxi-racing/actions/workflows/capy_racecard.yml';
  try {
    state = await advancePrelock(date,state,{
      read: fresh => read(fresh).catch(() => null), unlocked, save,
      now: () => new Date().toISOString(), notify: async text => (await sendTelegramAlert(text)).sent,
      runs: async () => {
        if (!gh) return null;
        const r = await fetch(`${workflow}/runs?branch=main&per_page=10`, {headers,signal:AbortSignal.timeout(8_000)}).catch(()=>null);
        if (!r?.ok) return null;
        const parsed = z.object({workflow_runs:z.array(z.object({id:z.number(),created_at:z.string().datetime(),status:z.string(),conclusion:z.string().nullable()}))}).safeParse(await r.json());
        return parsed.success ? parsed.data.workflow_runs : null;
      },
      dispatch: async () => gh ? await fetch(`${workflow}/dispatches`,{method:'POST',headers,body:JSON.stringify({ref:'main'}),signal:AbortSignal.timeout(8_000)}).then(r=>r.status===204).catch(()=>false) : false,
    });
    return { action: state.phase, stale: state.stale ?? [], runId: state.runId ?? null, freezeAuthorized: false };
  } finally { await save(state,true); }
}
