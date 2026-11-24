import { summarizeOfficialMetrics, type OfficialMetricInput } from './racing-official-metrics';
/** View adapter: verified originals only, never alternative selections for KPI. */
export function resultsAudit(snapshot: { races: any[] }) {
  const races = snapshot.races.map(r => {
    if (r.redacted) return { ...r, actualTop4: (r.actualTop4 ?? []).map((n: number, i: number) => ({ ...r.results?.find((p: any) => p.horseNumber === n), horseNumber: n, position: i + 1 })) };
    const input = r.metricInput as OfficialMetricInput;
    const eligible = r.officialMetric.eligible;
    const top3 = new Set(input.actualTop4.slice(0, 3));
    const top3Hits = eligible ? input.original.slice(0, 3).filter(n => top3.has(n)).length : null;
    const predictedTop4 = input.original.map((n, i) => ({ ...r.picks.find((p: any) => p.horseNumber === n), horseNumber: n, rank: i + 1, hit: eligible && input.actualTop4.includes(n) }));
    const actualTop4 = input.actualTop4.map((n, i) => ({ ...r.picks.find((p: any) => p.horseNumber === n), ...r.results.find((p: any) => p.horseNumber === n), horseNumber: n, position: i + 1, hit: eligible && input.original.includes(n) }));
    return { ...r, predictedTop4, actualTop4, top4IntersectCount: r.officialMetric.originalHits,
      top3IntersectCount: top3Hits, top3AnyHit: eligible ? Number(top3Hits) > 0 : null,
      trioHit: eligible ? top3Hits === 3 : null, first4Hit: eligible ? r.officialMetric.originalHits === 4 : null };
  });
  const formal = races.filter(r => !r.redacted && r.officialMetric.eligible);
  const summary = summarizeOfficialMetrics(snapshot.races.filter(r => !r.redacted).map(r => r.metricInput));
  const percent = (n: number) => formal.length ? n / formal.length * 100 : null;
  const top3AnyHits = formal.filter(r => r.top3AnyHit).length;
  const trioHits = formal.filter(r => r.trioHit).length;
  const first4Hits = formal.filter(r => r.first4Hit).length;
  return { races, summary: { ...summary, top4AvgIntersect: summary.originalAverage,
    top3AvgIntersect: formal.length ? formal.reduce((n, r) => n + Number(r.top3IntersectCount), 0) / formal.length : null,
    top3AnyHits, top3AnyHitRate: percent(top3AnyHits), trioHits, trioHitRate: percent(trioHits), first4Hits, first4HitRate: percent(first4Hits) } };
}
