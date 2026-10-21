import { describe, expect, it, vi } from 'vitest';
vi.mock('./official-favourites.functions', () => ({ getOfficialFavourites: vi.fn() }));
vi.mock('./hkjc-changes.functions', () => ({ getHkjcChanges: vi.fn() }));
import { calcPools } from './racingPoolAccounting';
import { summarizeOfficialMetrics } from './racing-official-metrics';

// Read-only observed 2026-10-19 original snapshot:
// 388f22b44e13e2124e46d3a703027025d401225725152879793b4578f148ce89
// Original selections are never replaced in the official hit metric.
const originals = [[4,2,6,1],[10,11,8,2],[3,2,9,5],[12,4,10,14],[2,12,10,11],[3,10,8,1],[4,3,1,11],[2,4,10,7],[1,10,7,3],[7,14,1,3],[8,13,6,2]];
const actual = [[6,11,13,4],[7,2,5,6],[13,2,5,12],[14,11,4,6],[8,10,12,9],[12,5,10,3],[4,7,3,1],[7,6,2,10],[6,1,8,12],[1,11,5,7],[8,13,7,6]];

describe('10月19日真實退出案例回歸', () => {
  it('11場原四揀共中23匹，鎖前未重算及鎖後退出仍固定分母4', () => {
    const inputs = originals.map((original, i) => ({ original, actualTop4: actual[i] ?? [], status: 'valid', hasWithdrawal: i >= 7, postLockJockeyChange: false }));
    expect(summarizeOfficialMetrics(inputs)).toMatchObject({ races: 11, excluded: 0, originalHits: 23, originalAverage: 23 / 11 });
  });
  it('第5口孖T原票9注90元，官方熱門替補不改原注，未中派彩0', () => {
    const r10 = { race: 10, bankers: [7,14], legs: [1,3,4], fifthFromLive: false as const };
    const r11 = { race: 11, bankers: [8,13], legs: [6,2,10], fifthFromLive: false as const };
    // Official CSV row: 第五口孖T, "1,5,11/7>2,8,13", 90902 per $10.
    const [pool] = calcPools([{ race_no: 11, pool: '第五口孖T', combo: '1,5,11/7>2,8,13', dividend: 90902, unit: 10 }], {10:r10,11:r11}, {10:new Set([3]),11:new Set([2])}, {10:[1,2,4,7,12],11:[8,13,1,6,10]});
    expect(pool).toMatchObject({ missing: false, units: 9, cost: 90, mainHit: false, payout: 0 });
    expect(r10.legs).toEqual([1,3,4]);
    expect(r11.legs).toEqual([6,2,10]);
    expect(pool?.detail[0]?.settled?.legs).toEqual([1,1,4]);
    expect(pool?.detail[1]?.settled?.legs).toEqual([6,1,10]);
  });
});