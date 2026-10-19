import { describe, it, expect } from 'vitest';
import { resultsAudit } from './results-audit';
import { officialRaceMetric } from './racing-official-metrics';
const race = (status: string) => {
  const metricInput = { original: [8,13,6,2], effective: [8,13,6,10], actualTop4: [8,13,7,6], status, hasWithdrawal: true, postLockJockeyChange: false };
  return { metricInput, officialMetric: officialRaceMetric(metricInput), picks: [], results: [] };
};
describe('戰績頁原凍結接線', () => {
  it('鎖前無效場次不入分母，鎖後原四揀仍計三匹', () => {
    expect(resultsAudit({ races: [race('invalid-prelock-input'), race('valid')] }).summary).toMatchObject({ races: 1, excluded: 1, top4AvgIntersect: 3 });
  });
  it('補位只供展示不替換原四揀', () => {
    expect(resultsAudit({ races: [race('valid')] }).races[0].predictedTop4.map((p: { horseNumber: number }) => p.horseNumber)).toEqual([8,13,6,2]);
  });
});
