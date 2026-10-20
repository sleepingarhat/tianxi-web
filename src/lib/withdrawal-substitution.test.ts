import { describe, it, expect } from 'vitest';
import { effectiveTop4 } from './withdrawal-substitution';
import { officialRaceMetric } from './racing-official-metrics';

const lockAt = '2026-10-19T03:00:00Z';
const five = (out?: number, announcedAtIso: string | null = '2026-10-19T03:01:00Z') => [1, 2, 3, 4, 5].map(n => ({ horseNumber: n, rank: n, withdrawn: n === out, announcedAtIso }));

describe('鎖後退出：保留原四揀，唔補位', () => {
  it('3號鎖後退出 → 原四揀1-2-3-4不變，有效1-2-4', () => {
    expect(effectiveTop4(five(3), lockAt)).toEqual({ original: [1, 2, 3, 4], valid: [1, 2, 4], withdrawn: [3], status: 'valid', prelockNotRecomputed: false });
  });
  it('第五選唔會補上', () => {
    expect(effectiveTop4(five(3), lockAt).valid).not.toContain(5);
  });
  it('有效3匹中2匹 → 記 2/4（分母固定4）', () => {
    const s = effectiveTop4(five(3), lockAt);
    expect(officialRaceMetric({ original: s.original, actualTop4: [1, 2, 6, 7], status: s.status, hasWithdrawal: true, postLockJockeyChange: false }).originalHits).toBe(2);
  });
  it('鎖前已退出但未重算 → 按鎖後方式照計，退出馬當冇中', () => {
    const s = effectiveTop4(five(4, '2026-10-15T09:04:00Z'), lockAt);
    expect(s).toMatchObject({ status: 'valid', valid: [1, 2, 3], prelockNotRecomputed: true });
    expect(officialRaceMetric({ original: s.original, actualTop4: [1, 6, 7, 8], status: s.status, hasWithdrawal: true, postLockJockeyChange: false }).originalHits).toBe(1);
  });
  it('等於鎖點當鎖前', () => {
    expect(effectiveTop4(five(4, lockAt), lockAt).prelockNotRecomputed).toBe(true);
  });
  it('缺官方時間 → 待核', () => {
    expect(effectiveTop4(five(4, null), lockAt).status).toBe('unverified-change-timing');
  });
});
