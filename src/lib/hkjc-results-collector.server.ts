import { parseOfficialResults, verifyOfficialResultCoverage, type OfficialRunnerResult } from './hkjc-official-results';
import { publicRacingQuery } from './public-racing-evidence.server';
import { officialWithdrawal } from './hkjc-changes';

/** Caller is authenticated by the managed cron route before entering here. */
export async function collectOfficialRace(date: string, venue: string, raceNumber: number) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const claimed = await supabaseAdmin.rpc('claim_official_collection_lease', { lease_id: `${date}:${venue}:${raceNumber}` });
  if (claimed.error) throw new Error('result-lease-failed');
  if (!claimed.data) return { raceNumber, action: 'lease-active' };
  const sourceUrl = `https://racing.hkjc.com/en-us/local/information/localresults?RaceDate=${date.replaceAll('-','%2F')}&Racecourse=${venue}&RaceNo=${raceNumber}`;
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error(`official-result-http-${response.status}`);
  const html = await response.text();
  if (html.length > 2_000_000) throw new Error('official-result-too-large');
  const results = parseOfficialResults(html, date, raceNumber);
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(html))),n=>n.toString(16).padStart(2,'0')).join('');
  const card = await publicRacingQuery<{horseNumber:number;horseId:string;nameCh:string}>(`SELECT e.horse_number horseNumber,e.horse_id horseId,h.name_ch nameCh FROM entries_upcoming e LEFT JOIN horses h ON h.id=e.horse_id WHERE e.race_date=? AND e.venue=? AND e.race_number=?`,[date,venue,raceNumber]);
  const { readLatestHkjcChanges } = await import('./hkjc-changes.server');
  const changes = await readLatestHkjcChanges(date);
  const withdrawn = new Set(card.filter(r=>changes?.venue===venue && officialWithdrawal(changes.changes as unknown as import('./hkjc-changes').HkjcChange[],raceNumber,r.horseNumber,r.nameCh)).map(r=>r.horseNumber));
  // Pre-lock withdrawn runners are deleted from the D1 card but HKJC still
  // lists them without a placing. Accept them only when an official changes
  // notice confirms the exact identity; without a notice coverage still fails.
  const onCard = new Set(card.map(r=>r.horseNumber));
  const offCard = results.filter(r=>!onCard.has(r.horseNumber) && r.finishingPosition===null);
  const offCardWithdrawn = new Set<string>();
  if (offCard.length) {
    const ids = offCard.map(r=>`horse_${r.horseId}`);
    const names = await publicRacingQuery<{id:string;nameCh:string}>(`SELECT id,name_ch nameCh FROM horses WHERE id IN (${ids.map(()=>'?').join(',')})`,ids);
    const nameById = new Map(names.map(n=>[n.id,n.nameCh]));
    for (const r of offCard) {
      const fullId = `horse_${r.horseId}`;
      if (changes?.venue===venue && officialWithdrawal(changes.changes as unknown as import('./hkjc-changes').HkjcChange[],raceNumber,r.horseNumber,nameById.get(fullId),fullId)) offCardWithdrawn.add(`${r.horseNumber}:${r.horseId}`);
    }
  }
  verifyOfficialResultCoverage(results,card,withdrawn,offCardWithdrawn);
  const saved = await supabaseAdmin.from('racing_official_result_snapshots').upsert({race_date:date,venue,race_number:raceNumber,source_url:sourceUrl,source_sha256:sha256,raw_html:html,results:JSON.parse(JSON.stringify(results)),identity_verified:true},{onConflict:'race_date,venue,race_number,source_sha256',ignoreDuplicates:true});
  if (saved.error) throw new Error('official-result-archive-failed');
  return { raceNumber, action:'archived-identity-verified',sha256 };
}

/** Public read-only projection: no raw HTML or privileged client required. */
export async function readCloudOfficialResults(date:string,venue:string) {
  const { supabase } = await import('@/integrations/supabase/client');
  const response = await supabase.from('racing_official_result_snapshots').select('race_number,results,source_url,source_sha256,fetched_at').eq('race_date',date).eq('venue',venue).eq('identity_verified',true).order('fetched_at',{ascending:false}).limit(36);
  if (response.error) throw new Error('official-result-read-failed');
  const races = new Map<number,{raceNumber:number;results:OfficialRunnerResult[];sourceUrl:string;sha256:string;fetchedAt:string}>();
  for (const row of response.data ?? []) {
    if (races.has(row.race_number)) continue;
    const results = (row.results as unknown as OfficialRunnerResult[]).map(r=>({...r,horseId:`horse_${r.horseId}`}));
    races.set(row.race_number,{raceNumber:row.race_number,results,sourceUrl:row.source_url,sha256:row.source_sha256,fetchedAt:row.fetched_at});
  }
  return [...races.values()];
}