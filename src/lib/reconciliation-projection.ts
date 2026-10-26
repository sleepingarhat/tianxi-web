import type { Tier } from './tiers';

type Row = Record<string, any> & { raceNumber?: number; horseNumber?: number };
const META = ['raceNumber','raceId','date','venue','startTime','title','class','distance','going','track','course','runners','resultsStatus'];
const RESULT = ['raceNumber','horseId','horseNumber','nameCh','nameEn','finishingPosition','position','winOdds','runningPosition'];
function allowed(row: Row, keys: string[]): Row {
  return Object.fromEntries(keys.filter(k => row[k] === null || ['string','number','boolean'].includes(typeof row[k])).map(k => [k,row[k]]));
}
export function resultsOnlyRace(row: Row): Row {
  const out = allowed(row, META);
  for (const key of ['results','actualTop4']) if (Array.isArray(row[key])) {
    out[key] = row[key].map((r: unknown) => {
      if (typeof r === 'number') return r;
      const result = (r ?? {}) as Row;
      const identity = (row['picks'] ?? []).find((p: Row) => p['horseId'] === result['horseId'] && p.horseNumber === result.horseNumber);
      return allowed({ ...identity, ...result }, RESULT);
    });
  }
  if (!out['actualTop4'] && Array.isArray(out['results'])) out['actualTop4'] = out['results']
    .filter((r: Row) => Number(r['finishingPosition']) >= 1 && Number(r['finishingPosition']) <= 4)
    .sort((a: Row,b: Row) => Number(a['finishingPosition'])-Number(b['finishingPosition']))
    .map((r: Row) => r.horseNumber);
  return { ...out, redacted: true };
}
/** Public summaries stay public; hidden race-level model data never crosses the boundary. */
export function projectFrozenReconciliation<T extends { races: any[] }>(body: T, tier: Tier): T {
  if (tier === 'registered' || tier === 'pro') return body;
  return { ...body, races: body.races.map(r => Number(r.raceNumber) === 1 ? r : resultsOnlyRace(r)) } as T;
}
export function projectFreezeLedger<T extends { meetings?: any[] }>(body: T, tier: Tier): T {
  if (tier === 'registered' || tier === 'pro') return body;
  return { ...body, meetings: body.meetings?.map(m => ({ ...m, races: (m.races ?? []).map((r: Row) => Number(r.raceNumber) === 1 ? r : resultsOnlyRace(r)) })) };
}
export function projectReconciliationRows<T extends Row>(rows: T[], tier: Tier): T[] {
  if (tier === 'registered' || tier === 'pro') return rows;
  return rows.map(r => Number(r.raceNumber) === 1 ? r : {
    ...allowed(r, ['raceId','raceNumber','venue','horseId','name','horseNumber','startTime','finish']),
    rank: null, predictionHorseNumber: null, horseElo: null, jockeyElo: null, trainerElo: null,
    composite: null, score: null, lgb: null, loggedFinish: null, generatedAt: null, version: null, source: null,
    timing: 'missing', redacted: true,
  } as unknown as T).sort((a,b) => Number(a.raceNumber)-Number(b.raceNumber) || (Number(a.raceNumber) === 1 ? 0 : Number(a.horseNumber)-Number(b.horseNumber)));
}