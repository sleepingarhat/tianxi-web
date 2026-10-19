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
