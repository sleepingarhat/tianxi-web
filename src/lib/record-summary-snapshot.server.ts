import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { recordSummary, type RecordSummary } from './track-record-summary';

/** Only complete public DTOs may be published; no private cache table is readable here. */
export function validateSummarySnapshot(value: unknown): RecordSummary {
  const summary = value as RecordSummary | null;
  if (!summary || summary.schemaVersion !== 1 || summary.source !== 'public-hit-rate-rollup' || !Number.isFinite(Date.parse(summary.generatedAt)) || !summary.rollups || !summary.market || !Array.isArray(summary.versions?.versions)) throw new Error('戰績摘要未完整');
  const rebuilt = recordSummary(Object.values(summary.rollups), summary.generatedAt);
  for (const days of [30, 60, 90, 180]) {
    const market = summary.market[String(days)];
    const entry = summary.summary?.[`last${days}`];
    const original = rebuilt.summary[`last${days}`];
    if (!market || !Number.isInteger(market.races) || market.races < 0 || !Number.isFinite(Date.parse(market.checkedAt)) || !entry || entry.races !== original?.races || entry.avgHit !== original?.avgHit || [market.average, market.pairedModel].some(v => v !== null && (!Number.isFinite(v) || v < 0 || v > 4))) throw new Error('戰績摘要未完整');
  }
  return summary;
}

function publicClient() {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new Error('戰績摘要暫未能讀取');
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
      headers.set('apikey', key);
      return fetch(input, { ...init, headers, signal: AbortSignal.timeout(3_000) });
    } },
  });
}

/** A cold invocation reads exactly one published snapshot, never the underlying racing sources. */
export async function readPublishedSummary(): Promise<RecordSummary> {
  const { data, error } = await publicClient().from('track_record_summary_snapshot').select('payload').eq('key', 'current').maybeSingle();
  if (error || !data) throw new Error('戰績摘要暫未能讀取，請稍後重試');
  return validateSummarySnapshot(data.payload);
}

/** Called only after managed cron authentication; keep last complete snapshot on any failure. */
export async function publishSummary(value: RecordSummary): Promise<RecordSummary> {
  const summary = validateSummarySnapshot(value);
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { error } = await supabaseAdmin.from('track_record_summary_snapshot').upsert({ key: 'current', payload: summary as unknown as Database['public']['Tables']['track_record_summary_snapshot']['Insert']['payload'], computed_at: summary.generatedAt });
  if (error) throw new Error('戰績摘要保存失敗');
  return summary;
}