import { describe, expect, it } from 'vitest';
import { officialRaceMetric, summarizeOfficialMetrics, type OfficialMetricInput } from './racing-official-metrics';
const base: OfficialMetricInput = { original: [1,2,3,4], actualTop4: [1,2,3,5], status: 'valid', hasWithdrawal: true, postLockJockeyChange: false };
describe('原凍結正式戰績', () => {
  it('不完整或重複官方頭四不計分', () => {
    expect(officialRaceMetric({ ...base, actualTop4: [1,2,3,3] }).eligible).toBe(false);
    expect(officialRaceMetric({ ...base, actualTop4: [1,2,3] }).eligible).toBe(false);
  });
  it('4號鎖後退出：原四揀中3匹，記3/4', () => {
    expect(officialRaceMetric(base)).toMatchObject({ originalHits: 3, includedInOfficialMetrics: true });
    expect(summarizeOfficialMetrics([base])).toMatchObject({ races: 1, originalHits: 3, originalAverage: 3 });
  });
  it('鎖前無效不計命中或分母', () => {
    expect(summarizeOfficialMetrics([{ ...base, status: 'invalid-prelock-input' }, base])).toMatchObject({ races: 1, excluded: 1, originalHits: 3 });
  });
  it('時間未知留待核不入分母', () => {
    expect(officialRaceMetric({ ...base, status: 'unverified-change-timing' }).eligible).toBe(false);
  });
  it('鎖後換騎照計原戰績並另列分組', () => {
    const summary = summarizeOfficialMetrics([{ ...base, hasWithdrawal: false, postLockJockeyChange: true }]);
    expect(summary.groups['post-lock-jockey-change']).toMatchObject({ races: 1, originalHits: 3 });
    expect(summary.groups.unchanged.races).toBe(0);
  });
});
