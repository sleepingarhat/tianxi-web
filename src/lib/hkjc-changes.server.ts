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
  const lock = await fetch(`${WORKER}/api/analyze/lock-state`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) }).then(r => r.ok ? r.json() as Promise<{ date?: string; locked?: boolean; edition?: string }> : null).catch(() => null);
  if (!lock || lock.date !== date) return { action: 'none' as const, reason: 'not-meeting-day-or-lock-unknown' };
  if (lock.locked || lock.edition === 'final') return { action: 'none' as const, reason: 'locked-use-frozen-order-substitution' };
  const token = process.env['TIANXI_ADMIN_TOKEN'];
  const picksUrl = `${WORKER}/api/analyze/today-picks`;
  const read = async (fresh: boolean) => {
    const r = await fetch(picksUrl + (fresh ? '?fresh=1' : ''), { cache: 'no-store', headers: token ? { authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(60_000) });
    return r.ok ? await r.json() as { races?: { raceNumber: number; picks?: { horseNumber: number; nameCh?: string }[] }[] } : null;
  };
  const { officialWithdrawal } = await import('./hkjc-changes');
  const stale = (body: Awaited<ReturnType<typeof read>>) => (body?.races ?? []).flatMap(r => (r.picks ?? []).filter(p => officialWithdrawal(changes, r.raceNumber, p.horseNumber, p.nameCh)).map(p => `R${r.raceNumber} #${p.horseNumber} ${p.nameCh}`));
  const { staleCheckOutcome } = await import('./changes-evidence');
  const { sendTelegramAlert } = await import('./telegramAlert.server');
  const firstBody = await read(false).catch(() => null);
  const before = stale(firstBody);
  if (staleCheckOutcome(firstBody, before) === 'unknown') {
    await sendTelegramAlert(`⚠️ 賽前更改：${date} 未能讀取未鎖預測，無法核實是否已剔除退出馬匹；未核實前唔好凍結。`).catch(() => null);
    return { action: 'blocked' as const, reason: 'picks-unreadable' };
  }
  if (!before.length) return { action: 'none' as const, reason: 'picks-already-exclude-withdrawals' };
  // Refresh the racecard from HKJC (GitHub workflow) then ask for a fresh compute.
  const gh = process.env['GITHUB_TOKEN'];
  const dispatched = gh ? await fetch('https://api.github.com/repos/sleepingarhat/tianxi-racing/actions/workflows/capy_racecard.yml/dispatches', { method: 'POST', headers: { authorization: `Bearer ${gh}`, accept: 'application/vnd.github+json', 'user-agent': 'tianxi-web' }, body: JSON.stringify({ ref: 'main' }) }).then(r => r.status === 204).catch(() => false) : false;
  const afterBody = await read(true).catch(() => null);
  const after = stale(afterBody);
  const outcome = staleCheckOutcome(afterBody, after);
  const tail = outcome === 'unknown' ? '重算結果讀取失敗，未能核實已剔除，唔好凍結' : outcome === 'stale' ? `仍含 ${after.join('、')}，排位未更新前唔好凍結` : '已剔除';
  await sendTelegramAlert(`⚠️ 賽前更改：${date} 未鎖預測仍含馬會已公布退出馬匹（${before.join('、')}）。已${dispatched ? '觸發排位更新' : '未能觸發排位更新'}並要求重算；重算後${tail}。`).catch(() => null);
  return { action: 'recompute-requested' as const, staleBefore: before, staleAfter: after, afterVerified: outcome !== 'unknown', racecardDispatched: dispatched };
}
