import { officialRaceMetric } from './racing-official-metrics';

export function frozenComparison(data: { frozen?: boolean; races?: any[] }) {
  if (!data.frozen || !data.races?.length) throw new Error('原凍結預測暫未能核實；紀錄不變，請稍後重新讀取。');
  const races = data.races.map(r => {
    if ('redacted' in r && r.redacted) return { ...r, predictedTop4: [], top4IntersectCount: null, top3IntersectCount: null };
    const metric = officialRaceMetric(r.metricInput);
    const top3 = r.results.filter((x: any)=>x.finishingPosition != null && x.finishingPosition>=1 && x.finishingPosition<=3).map((x: any)=>x.horseNumber);
    return {...r, predictedTop4:r.picks.slice(0,4),top4IntersectCount:metric.originalHits,
      top3IntersectCount:metric.eligible && top3.length===3 ? r.picks.slice(0,3).filter((p: any)=>top3.includes(p.horseNumber)).length : null};
  });
  const scored = races.filter(r=>r.top4IntersectCount != null);
  const threes = scored.filter(r=>r.top3IntersectCount != null);
  return {races,summary:scored.length ? {racesEvaluated:scored.length,
    top4AvgIntersect:scored.reduce((s,r)=>s+(r.top4IntersectCount ?? 0),0)/scored.length,
    top3AvgIntersect:threes.length ? threes.reduce((s,r)=>s+(r.top3IntersectCount ?? 0),0)/threes.length : null} : null};
}