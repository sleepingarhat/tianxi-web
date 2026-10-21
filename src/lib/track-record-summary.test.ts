import { describe, expect, it } from 'vitest';
import { recordSummary, type RecordRollup } from './track-record-summary';
const rows = [30, 60, 90, 180].map(windowDays => ({ windowDays, racesEvaluated: 118, meetingsEvaluated: 12, top4AvgIntersect: 1.99, generatedAt: '2026-10-21T00:26:39Z', perMeeting: [] } satisfies RecordRollup));
describe('戰績摘要沿用正式窗口數字', () => {
  it('近90日118場1.99/4直接沿用來源，不用每日平均反算', () => {
    expect(recordSummary(rows).summary['last90']).toMatchObject({ races: 118, avgHit: 1.99, marketAvg: null });
  });
  it('缺窗口或越界命中不能發布摘要', () => {
    expect(() => recordSummary(rows.slice(1))).toThrow();
    expect(() => recordSummary(rows.map(r => ({ ...r, top4AvgIntersect: 5 })))).toThrow();
  });
  it('市場只按相同賽日馬場的完整配對逐場計算，保留自身分母', () => {
    const windows = rows.map(r => ({ ...r, perMeeting: [{ date: '2026-10-19', venue: 'ST', racesEvaluated: 11, top4AvgIntersect: 2.09 }] }));
    const result = recordSummary(windows, '2026-10-21T00:00:00Z', { coverage: { checkedAt: '2026-10-21T00:00:00Z', rows: [
      { date: '2026-10-19', venue: 'ST', raceNo: 1, band: '短途', model: 2, market: 3 },
      { date: '2026-10-19', venue: 'ST', raceNo: 2, band: '短途', model: 1, market: null },
      { date: '2026-10-19', venue: 'HV', raceNo: 1, band: '短途', model: 4, market: 4 },
    ] } });
    expect(result.market?.['90']).toMatchObject({ average: 3, pairedModel: 2, races: 1 });
    expect(result.summary['last90']?.races).toBe(118);
  });
});