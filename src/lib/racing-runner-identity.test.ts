import { describe, expect, it } from 'vitest';
import { verifyRunnerIdentities, identityMatchedEntry, evidenceDraw, resultsForFrozenIdentity } from './racing-runner-identity';

const original = [{ raceNumber: 10, horseNumber: 3, horseId: 'horse_K554' }];
describe('馬匹身份跨来源核對', () => {
  it('10月21日第1場9號K319鎖前退出、未入凍結；官方無名次行不阻截原凍結', () => {
    const frozen = [{ raceNumber: 1, horseNumber: 6, horseId: 'horse_K307' }];
    const scratched = { raceNumber: 1, horseNumber: 9, horseId: 'horse_K319', finishingPosition: null };
    const results = resultsForFrozenIdentity(frozen, [...frozen, scratched], new Set(['1:horse_K319']));
    expect(results).toEqual(frozen);
    expect(verifyRunnerIdentities(frozen, frozen, results).runners).toBe(1);
  });
  it('缺退出身份證據、未知馬或有名次仍不能略過', () => {
    const r = { raceNumber: 1, horseNumber: 9, horseId: 'horse_K319', finishingPosition: null };
    expect(resultsForFrozenIdentity([], [r], new Set())).toEqual([r]);
    expect(resultsForFrozenIdentity([], [{ ...r, horseId: 'horse_UNKNOWN' }], new Set(['1:horse_K319']))).toHaveLength(1);
    expect(resultsForFrozenIdentity([], [{ ...r, finishingPosition: 1 }], new Set(['1:horse_K319']))).toHaveLength(1);
  });
  it('補充馬名綵衣檔位必須同horseId，缺身份也不補', () => {
    expect(identityMatchedEntry('horse_K554', {horseId:'horse_L184'})).toBeUndefined();
    expect(identityMatchedEntry('horse_K554', {})).toBeUndefined();
    expect(identityMatchedEntry('horse_K554', {horseId:'horse_K554'})).toEqual({horseId:'horse_K554'});
  });
  it('第8場4號凍結缺檔位不可用現時值倒填', () => {
    expect(evidenceDraw(true, null, 7)).toBeNull();
    expect(evidenceDraw(true, 13, 7)).toBe(13);
    expect(evidenceDraw(false, null, 7)).toBe(7);
  });
  it('第10場3號K554不能被L184風將頂替，即使馬號相同', () => {
    expect(() => verifyRunnerIdentities(original, [{ raceNumber: 10, horseNumber: 3, horseId: 'horse_L184' }], [])).toThrow('第10場3號凍結馬匹與排位身份不一致');
    expect(original[0]?.horseId).toBe('horse_K554');
  });
  it('沒有排位證據不得通過', () => {
    expect(() => verifyRunnerIdentities(original, [], [])).toThrow('缺排位身份證據');
  });
  it('不同場次相同馬號不能當身份相同', () => {
    expect(() => verifyRunnerIdentities(original, [{ raceNumber: 9, horseNumber: 3, horseId: 'horse_K554' }], [])).toThrow('缺排位身份證據');
  });
  it('排位重複馬號即拒絕', () => {
    expect(() => verifyRunnerIdentities(original, [...original, ...original], [])).toThrow('重複');
  });
  it('同場同馬被綁兩個馬號即拒絕', () => {
    expect(() => verifyRunnerIdentities(original, [...original, { raceNumber: 10, horseNumber: 4, horseId: 'horse_K554' }], [])).toThrow('重複');
  });
  it('官方賽果另一身份不能按馬號硬配', () => {
    expect(() => verifyRunnerIdentities(original, original, [{ raceNumber: 10, horseNumber: 3, horseId: 'horse_L184' }])).toThrow('官方賽果');
  });
  it('全部身份相同且尚未入帳賽果可以讀回', () => {
    expect(verifyRunnerIdentities(original, original, [])).toEqual({ status: 'matched-current-card-and-available-results', runners: 1, officiallyWithdrawn: [] });
    expect(verifyRunnerIdentities(original, original, original).runners).toBe(1);
  });
  it('official HKJC withdrawal explains R10 H3 slot change without hiding other mismatches', () => {
    const swapped = [{ raceNumber: 10, horseNumber: 3, horseId: 'horse_L184' }];
    expect(verifyRunnerIdentities(original, swapped, swapped, new Set(['10:3'])).status).toBe('matched-except-official-withdrawals');
    expect(() => verifyRunnerIdentities(original, swapped, [], new Set(['10:4']))).toThrow('身份不一致');
  });
  it('已證實退出K554可保留無馬號無名次結果行，不能接納未知馬或有名次行', () => {
    const swapped = [{ raceNumber: 10, horseNumber: 3, horseId: 'horse_L184' }];
    const archived = { raceNumber: 10, horseNumber: null as unknown as number, horseId: 'horse_K554', finishingPosition: null };
    expect(verifyRunnerIdentities(original, swapped, [...swapped, archived], new Set(['10:3'])).runners).toBe(1);
    expect(() => verifyRunnerIdentities(original, swapped, [{ ...archived, horseId: 'horse_UNKNOWN' }], new Set(['10:3']))).toThrow('官方賽果');
    expect(() => verifyRunnerIdentities(original, swapped, [{ ...archived, finishingPosition: 1 }], new Set(['10:3']))).toThrow('官方賽果');
  });
});
