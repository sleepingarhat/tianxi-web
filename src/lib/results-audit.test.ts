import { describe, it, expect } from 'vitest';
import { resultsAudit } from './results-audit';
import { officialRaceMetric } from './racing-official-metrics';
const race = (status: string) => {
  const metricInput = { original: [8,13,6,2], actualTop4: [8,13,7,6], status, hasWithdrawal: true, postLockJockeyChange: false };
  return { metricInput, officialMetric: officialRaceMetric(metricInput), picks: [], results: [] };
};
describe('戰績頁原凍結接線', () => {
  it('鎖前無效場次不入分母，鎖後原四揀仍計三匹', () => {
    expect(resultsAudit({ races: [race('invalid-prelock-input'), race('valid')] }).summary).toMatchObject({ races: 1, excluded: 1, top4AvgIntersect: 3 });
  });
  it('平頭季軍保持官方第3，唔會順延成第4', () => {
    const metricInput = { original: [13,8,5,14], actualTop4: [9,8,6,13], status: 'valid', hasWithdrawal: false, postLockJockeyChange: false };
    const results = [
      { horseNumber: 9, finishingPosition: 1, nameCh: '玩笑' },
      { horseNumber: 8, finishingPosition: 2, nameCh: '正本巨星' },
      { horseNumber: 6, finishingPosition: 3, nameCh: '小霸王' },
      { horseNumber: 13, finishingPosition: 3, nameCh: '實力股' },
    ];
    const row = resultsAudit({ races: [{ metricInput, officialMetric: officialRaceMetric(metricInput), picks: [], results }] }).races[0];
    expect(row.actualTop4.map((a: { horseNumber: number; position: number }) => [a.horseNumber, a.position])).toEqual([[9,1],[8,2],[6,3],[13,3]]);
    expect(row.top3IntersectCount).toBe(2);
  });
  it('補位只供展示不替換原四揀', () => {
    expect(resultsAudit({ races: [race('valid')] }).races[0].predictedTop4.map((p: { horseNumber: number }) => p.horseNumber)).toEqual([8,13,6,2]);
  });
});
