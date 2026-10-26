import type { Tier } from './tiers';

type Row = Record<string, any> & { raceNumber?: number; horseNumber?: number };
const META = ['raceNumber','raceId','date','venue','startTime','title','class','distance','going','track','course','runners','resultsStatus'];
const RESULT = ['raceNumber','horseId','horseNumber','nameCh','nameEn','finishingPosition','position','winOdds','runningPosition'];
/** Meeting / season aggregates that include hidden races must not cross the guest boundary. */
const MEETING_KPI = [
  'racesEvaluated','top4AvgIntersect','top4CoveragePct','top4FullHits',
  'top3AvgIntersect','top3AnyHitPct','placeHitPct','winnerHitPct',
  'modelWinLogloss','marketWinLogloss','favouriteHitPct','flatWinRoiPct',
] as const;

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

/** Guest may see race 1 model data; later races stay results-only. */
export function isGuestVisibleRace(raceNumber: unknown): boolean {
  return Number(raceNumber) === 1;
}

function stripMeetingKpis(meeting: Row): Row {
  const out: Row = { ...meeting };
  for (const key of MEETING_KPI) {
    out[key] = key === 'racesEvaluated' || key === 'top4FullHits' ? 0 : null;
  }
  return out;
}

/** Recompute meeting KPIs from races that still carry model scores (never count redacted as zero). */
export function meetingKpisFromVisibleRaces(races: Row[]): Record<(typeof MEETING_KPI)[number], number | null> {
  const scored = races.filter(r => !r['redacted'] && typeof r['top4Intersect'] === 'number');
  const n = scored.length;
  const avg = (pick: (r: Row) => unknown) => {
    const xs = scored.map(pick).filter((x): x is number => typeof x === 'number');
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const pctTrue = (pick: (r: Row) => unknown) => {
    if (!n) return null;
    return 100 * scored.filter(r => Boolean(pick(r))).length / n;
  };
  if (!n) {
    return {
      racesEvaluated: 0, top4AvgIntersect: null, top4CoveragePct: null, top4FullHits: 0,
      top3AvgIntersect: null, top3AnyHitPct: null, placeHitPct: null, winnerHitPct: null,
      modelWinLogloss: null, marketWinLogloss: null, favouriteHitPct: null, flatWinRoiPct: null,
    };
  }
  const top4Avg = avg(r => r['top4Intersect']);
  const placeHits = scored.reduce((s, r) => s + (typeof r['placeHits'] === 'number' ? r['placeHits'] : 0), 0);
  const placeSlots = scored.reduce((s, r) => s + (typeof r['placeSlots'] === 'number' ? r['placeSlots'] : 0), 0);
  const flatPnl = scored.reduce((s, r) => s + (typeof r['flatWinPnl'] === 'number' ? r['flatWinPnl'] : 0), 0);
  return {
    racesEvaluated: n,
    top4AvgIntersect: top4Avg,
    top4CoveragePct: top4Avg == null ? null : Math.round((top4Avg / 4) * 1000) / 10,
    top4FullHits: scored.filter(r => r['top4Intersect'] === 4).length,
    top3AvgIntersect: avg(r => r['top3Intersect']),
    top3AnyHitPct: pctTrue(r => r['top3AnyHit']),
    placeHitPct: placeSlots ? Math.round((placeHits / placeSlots) * 1000) / 10 : null,
    winnerHitPct: pctTrue(r => r['winnerHit']),
    modelWinLogloss: avg(r => r['modelWinLogloss']),
    marketWinLogloss: avg(r => r['marketWinLogloss']),
    favouriteHitPct: pctTrue(r => r['favouriteHit']),
    flatWinRoiPct: Math.round((flatPnl / (n * 10)) * 1000) / 10,
  };
}

function seasonFromMeetings(meetings: Row[]): Row | undefined {
  const graded = meetings.filter(m => Number(m['racesEvaluated']) > 0);
  if (!graded.length) {
    return {
      meetings: 0, racesEvaluated: 0, top4AvgIntersect: null, top4CoveragePct: null, top4FullHits: 0,
      top3AvgIntersect: null, top3AnyHitPct: null, placeHitPct: null, winnerHitPct: null,
      modelWinLogloss: null, marketWinLogloss: null, favouriteHitPct: null, flatWinRoiPct: null,
    };
  }
  const races = graded.reduce((s, m) => s + Number(m['racesEvaluated']), 0);
  const weightAvg = (key: string) => {
    const xs = graded.filter(m => typeof m[key] === 'number');
    if (!xs.length) return null;
    const w = xs.reduce((s, m) => s + Number(m['racesEvaluated']), 0);
    return w ? xs.reduce((s, m) => s + Number(m[key]) * Number(m['racesEvaluated']), 0) / w : null;
  };
  return {
    meetings: graded.length,
    racesEvaluated: races,
    top4AvgIntersect: weightAvg('top4AvgIntersect'),
    top4CoveragePct: weightAvg('top4CoveragePct'),
    top4FullHits: graded.reduce((s, m) => s + Number(m['top4FullHits'] ?? 0), 0),
    top3AvgIntersect: weightAvg('top3AvgIntersect'),
    top3AnyHitPct: weightAvg('top3AnyHitPct'),
    placeHitPct: weightAvg('placeHitPct'),
    winnerHitPct: weightAvg('winnerHitPct'),
    modelWinLogloss: weightAvg('modelWinLogloss'),
    marketWinLogloss: weightAvg('marketWinLogloss'),
    favouriteHitPct: weightAvg('favouriteHitPct'),
    flatWinRoiPct: weightAvg('flatWinRoiPct'),
  };
}

/** Public historical rollups stay public; hidden race-level model data never crosses the boundary. */
export function projectFrozenReconciliation<T extends { races: any[] }>(body: T, tier: Tier): T {
  if (tier === 'registered' || tier === 'pro') return body;
  return { ...body, races: body.races.map(r => isGuestVisibleRace(r.raceNumber) ? r : resultsOnlyRace(r)) } as T;
}

export function projectFreezeLedger<T extends { meetings?: any[]; season?: any }>(body: T, tier: Tier): T {
  if (tier === 'registered' || tier === 'pro') return body;
  const meetings = body.meetings?.map(m => {
    const races = (m.races ?? []).map((r: Row) => isGuestVisibleRace(r.raceNumber) ? r : resultsOnlyRace(r));
    return { ...stripMeetingKpis(m), races, ...meetingKpisFromVisibleRaces(races) };
  });
  return { ...body, meetings, season: meetings ? seasonFromMeetings(meetings) : body.season };
}

export function projectReconciliationRows<T extends Row>(rows: T[], tier: Tier): T[] {
  if (tier === 'registered' || tier === 'pro') return rows;
  return rows.map(r => isGuestVisibleRace(r.raceNumber) ? r : {
    ...allowed(r, ['raceId','raceNumber','venue','horseId','name','horseNumber','startTime','finish']),
    rank: null, predictionHorseNumber: null, horseElo: null, jockeyElo: null, trainerElo: null,
    composite: null, score: null, lgb: null, loggedFinish: null, generatedAt: null, version: null, source: null,
    timing: 'missing', redacted: true,
  } as unknown as T).sort((a,b) => Number(a.raceNumber)-Number(b.raceNumber) || (isGuestVisibleRace(a.raceNumber) ? 0 : Number(a.horseNumber)-Number(b.horseNumber)));
}
