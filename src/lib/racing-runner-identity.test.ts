import { describe, expect, it } from 'vitest';
import { verifyRunnerIdentities, identityMatchedEntry, evidenceDraw } from './racing-runner-identity';

const original = [{ raceNumber: 10, horseNumber: 3, horseId: 'horse_K554' }];
describe('馬匹身份跨来源核對', () => {
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
    expect(verifyRunnerIdentities(original, original, [])).toEqual({ status: 'matched-current-card-and-available-results', runners: 1 });
    expect(verifyRunnerIdentities(original, original, original).runners).toBe(1);
  });
});