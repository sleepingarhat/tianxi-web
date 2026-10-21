import { parseOfficialDividends } from './hkjc-dividends';

/** Only called after managed cron authentication. No prediction writes. */
export async function collectOfficialDividends(date: string, venue: string, expectedRaces: number) {
  const sourceUrl = `https://racing.hkjc.com/zh-hk/local/information/resultsall?RaceDate=${date.replaceAll('-', '/')}`;
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`official-dividends-${response.status}`);
  const html = await response.text();
  if (html.length > 2_000_000) throw new Error('dividend-source-too-large');
  const evidence = parseOfficialDividends(html, date, venue, expectedRaces);
  const sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(html)))].map(b => b.toString(16).padStart(2,'0')).join('');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const saved = await supabaseAdmin.from('racing_dividend_snapshots').upsert({ race_date: date, venue, source_url: sourceUrl, source_sha256: sha, raw_html: html, dividends: JSON.parse(JSON.stringify(evidence.rows)), trio_combinations: evidence.trios, race_count: evidence.raceCount }, { onConflict: 'race_date,venue,source_sha256', ignoreDuplicates: true });
  if (saved.error) throw new Error(`dividend-archive-failed:${saved.error.message}`);
  const read = await supabaseAdmin.from('racing_dividend_snapshots').select('source_sha256').eq('race_date', date).eq('venue',venue).eq('source_sha256',sha).single();
  if (read.error || read.data?.source_sha256 !== sha) throw new Error('dividend-readback-failed');
  return { date, venue, sha256: sha, rows: evidence.rows.length, raceCount: evidence.raceCount };
}