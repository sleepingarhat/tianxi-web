export type RecordRollup = {
  windowDays: number; generatedAt: string; top4AvgIntersect: number | null;
  racesEvaluated: number; meetingsEvaluated: number;
  perMeeting: { date: string; venue: string; racesEvaluated: number; top4AvgIntersect: number | null }[];
};
export type RecordSummary = {
  schemaVersion: 1; generatedAt: string; source: 'public-hit-rate-rollup';
  summary: Record<string, { races: number; avgHit: number | null; marketAvg: number | null; sourceGeneratedAt: string }>;
  rollups: Record<string, RecordRollup>;
};
/** Keep the existing rollup denominator and averages, never re-average rounded daily figures. */
export function recordSummary(rollups: RecordRollup[], generatedAt = new Date().toISOString()): RecordSummary {
  const summary: RecordSummary['summary'] = {};
  const indexed: RecordSummary['rollups'] = {};
  for (const row of rollups) {
    if (![30, 60, 90, 180].includes(row.windowDays) || !Number.isInteger(row.racesEvaluated) || row.racesEvaluated < 0 || !Array.isArray(row.perMeeting) || !Number.isFinite(Date.parse(row.generatedAt)) || (row.top4AvgIntersect != null && (!Number.isFinite(row.top4AvgIntersect) || row.top4AvgIntersect < 0 || row.top4AvgIntersect > 4))) throw new Error('戰績摘要未完整');
    indexed[String(row.windowDays)] = row;
    summary[`last${row.windowDays}`] = { races: row.racesEvaluated, avgHit: row.top4AvgIntersect, marketAvg: null, sourceGeneratedAt: row.generatedAt };
  }
  if ([30, 60, 90, 180].some(days => !indexed[String(days)])) throw new Error('戰績摘要窗口未完整');
  return { schemaVersion: 1, generatedAt, source: 'public-hit-rate-rollup', summary, rollups: indexed };
}