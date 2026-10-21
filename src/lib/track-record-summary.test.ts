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
});