import { HKJC_CHANGES_URL, parseHkjcChangesPage } from './hkjc-changes';
import { changeKey, changeRevision } from './racing-change-progress';

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
/** venue/sha 限定：唔會將另一馬場或舊副本當成今次收料。 */
export async function readLatestHkjcChanges(date: string, venue?: string, sha256?: string) {
  const { createClient } = await import('@supabase/supabase-js');
  const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
  const sb = createClient(process.env['SUPABASE_URL']!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => { const h = new Headers(init?.headers); if (key.startsWith('sb_') && h.get('Authorization') === `Bearer ${key}`) h.delete('Authorization'); h.set('apikey', key); return fetch(input, { ...init, headers: h }); } },
  });
  const { data, error } = await sb.from('hkjc_changes_snapshots').select('race_date,venue,fetched_at,source_url,sha256,changes').eq('race_date', date).match({ ...(venue ? { venue } : {}), ...(sha256 ? { sha256 } : {}) }).order('fetched_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error('馬會更易事項暫時未能讀取');
  return data;
}

const WORKER = 'https://tianxi-backend.tianxi-entertainment.workers.dev';

/**
 * Pre-lock only: update the racecard for stale withdrawals or other official changes.
 * Unreadable picks must not prevent dispatch, but never certify a successful recompute.
 */
export async function recomputeIfStaleBeforeLock(changes: import('./hkjc-changes').HkjcChange[], date: string) {
  const { z } = await import('zod');
  const { advancePrelock } = await import('./prelock-workflow');
  const { supabaseAdmin: sb } = await import('@/integrations/supabase/client.server');
  const lease = crypto.randomUUID();
  const claimed = await sb.rpc('claim_racing_prelock', { _date: date, _token: lease });
  if (claimed.error) throw new Error('退出追蹤狀態未能核實，停止派送');
  if (claimed.data === null) return { action: 'lease-active' as const };
  const stateSchema = z.object({ warned: z.array(z.string()).optional(), recovered: z.array(z.string()).optional(), requestedAt: z.string().optional(), runId: z.number().optional(), phase: z.string().optional(), checkedAt: z.string().optional(), stale: z.array(z.string()).optional(), dispatchedRunId: z.number().optional(), error: z.string().optional(), changeRevision: z.string().optional(), recomputedAt: z.string().optional(), generatedAt: z.string().optional(), cardFailures: z.number().optional(), cardFailureNotified: z.boolean().optional() });
  let state = stateSchema.parse(claimed.data);
  let freshGeneratedAt: string | undefined;
  const save = async (next: import('./prelock-workflow').PrelockState, release = false) => {
    if (next.phase === 'clean' && next.recomputedAt && freshGeneratedAt) next.generatedAt = freshGeneratedAt;
    const result = await sb.rpc('save_racing_prelock', { _date: date, _token: lease, _state: next as import('@/integrations/supabase/types').Json, _release: release });
    if (result.error || !result.data) throw new Error('退出追蹤工作鎖失效，停止派送');
    state = next;
  };
  const unlocked = async () => {
    const lock = await fetch(`${WORKER}/api/analyze/lock-state`, { cache: 'no-store', signal: AbortSignal.timeout(8_000) }).then(r => r.ok ? r.json() as Promise<{ date?: string; locked?: boolean; edition?: string }> : null).catch(() => null);
    return lock?.date === date && lock.locked === false && lock.edition !== 'final';
  };
  const token = process.env['TIANXI_ADMIN_TOKEN'];
  const changeKeys = [...new Set(changes.map(changeKey))].sort();
  const picksUrl = `${WORKER}/api/analyze/today-picks`;
  const read = async (fresh: boolean) => {
    if (fresh && !token) return null;
    // 重算讀取實測約19秒，放寬至45秒；一般讀取維持15秒。
    const r = await fetch(picksUrl + (fresh ? '?fresh=1' : ''), { cache: 'no-store', headers: token ? { authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(fresh ? 45_000 : 15_000) });
    if (!r.ok) return null;
    const body = z.object({ date: z.string(), generatedAt: z.string().optional(), races: z.array(z.object({ raceNumber: z.number().int().positive(), picks: z.array(z.object({ horseNumber: z.number().int().positive(), nameCh: z.string().min(1) })).min(4) })).min(1) }).safeParse(await r.json());
    if (!body.success || body.data.date !== date) return null;
    const removed = body.data.races.flatMap(r => r.picks.filter(p => officialWithdrawal(changes,r.raceNumber,p.horseNumber,p.nameCh)).map(p => `R${r.raceNumber} #${p.horseNumber} ${p.nameCh}`));
    // 換騎／改磅／後備補上都要在公告後重算；缺生成時間不能宣稱更新完成。
    const generated = Date.parse(body.data.generatedAt ?? '');
    if (fresh && Number.isFinite(generated)) freshGeneratedAt = new Date(generated).toISOString();
    const staleChanges = changes.filter(c => {
      const announced = Date.parse(c.announcedAtIso ?? '');
      return !Number.isFinite(generated) || !Number.isFinite(announced) || generated <= announced;
    }).map(changeKey);
    return [...new Set([...removed, ...staleChanges])];
  };
  const { officialWithdrawal } = await import('./hkjc-changes');
  const { sendTelegramAlert } = await import('./telegramAlert.server');
  const gh = process.env['GITHUB_TOKEN'];
  const headers = { authorization: `Bearer ${gh ?? ''}`, accept: 'application/vnd.github+json', 'user-agent': 'tianxi-web' };
  const workflow = 'https://api.github.com/repos/sleepingarhat/tianxi-racing/actions/workflows/capy_racecard.yml';
  // 工作鎖心跳：每30秒延長，外部步驟超過120秒都唔會失鎖。
  let heartbeatFailed = false;
  const beat = setInterval(() => {
    void Promise.resolve(sb.rpc('renew_racing_prelock', { _date: date, _token: lease }))
      .then(result => { if (result.error || !result.data) heartbeatFailed = true; })
      .catch(() => { heartbeatFailed = true; });
  }, 30_000);
  try {
    state = await advancePrelock(date,state,{
      read: fresh => read(fresh).catch(() => null), unlocked, save,
      pendingChanges: changeKeys, changeRevision: changeRevision(changes),
      now: () => new Date().toISOString(), notify: async text => (await sendTelegramAlert(text)).sent,
      runs: async () => {
        if (!gh) return null;
        const r = await fetch(`${workflow}/runs?branch=main&per_page=10`, {headers,signal:AbortSignal.timeout(8_000)}).catch(()=>null);
        if (!r?.ok) return null;
        const parsed = z.object({workflow_runs:z.array(z.object({id:z.number(),created_at:z.string().datetime(),status:z.string(),conclusion:z.string().nullable()}))}).safeParse(await r.json());
        return parsed.success ? parsed.data.workflow_runs : null;
      },
      run: async id => {
        if (!gh) return null;
        const r = await fetch(`https://api.github.com/repos/sleepingarhat/tianxi-racing/actions/runs/${id}`, {headers,signal:AbortSignal.timeout(8_000)}).catch(()=>null);
        if (!r?.ok) return null;
        const p = z.object({id:z.number(),created_at:z.string().datetime(),status:z.string(),conclusion:z.string().nullable(),path:z.string().optional()}).safeParse(await r.json());
        return p.success && (!p.data.path || p.data.path.endsWith('capy_racecard.yml')) ? p.data : null;
      },
      // return_run_details：GitHub 直接回傳今次 run id，唔再憑時間估。
      dispatch: async () => {
        if (!gh) return null;
        const r = await fetch(`${workflow}/dispatches`,{method:'POST',headers,body:JSON.stringify({ref:'main',return_run_details:true}),signal:AbortSignal.timeout(30_000)}).catch(()=>null);
        if (!r || r.status !== 200) return null;
        const p = z.object({workflow_run_id:z.number().int().positive()}).safeParse(await r.json().catch(()=>null));
        return p.success ? p.data.workflow_run_id : null;
      },
    });
    if (heartbeatFailed) throw new Error('退出追蹤工作鎖心跳未能核實');
    return { action: state.phase, stale: state.stale ?? [], runId: state.runId ?? null, freezeAuthorized: false };
  } finally { clearInterval(beat); await save(state,true); }
}
