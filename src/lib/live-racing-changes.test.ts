import { describe, expect, it } from 'vitest';
import { liveWithdrawal } from './live-racing-changes';
import { effectiveTop4 } from './withdrawal-substitution';
import type { HkjcChange } from './hkjc-changes';

const notice: HkjcChange = { raceNumber: 11, horseNumber: 2, horseName: '極上紗瓏', kind: 'scratched', replacement: null, text: '退出競賽', announcedAt: '19/10 17:35', announcedAtIso: '2026-10-19T09:35:00.000Z' };
const lock = '2026-10-19T00:48:00Z';
describe('即時退出公告只讀合併', () => {
  it('R11 H2鎖後退出只剩三匹有效，原四揀不改亦不補位', () => {
    const picks = [8, 13, 6, 2, 10].map((horseNumber, i) => {
      const c = liveWithdrawal([notice], 11, { horseNumber, nameCh: horseNumber === 2 ? '極上紗瓏' : '其他馬' }, lock);
      return { horseNumber, rank: i + 1, withdrawn: !!c, announcedAtIso: c?.announcedAtIso };
    });
    expect(effectiveTop4(picks, lock)).toMatchObject({ original: [8, 13, 6, 2], valid: [8, 13, 6], withdrawn: [2], status: 'valid' });
  });
  it('不同場次或馬名不得按馬號套退出', () => {
    expect(liveWithdrawal([notice], 10, { horseNumber: 2, nameCh: '極上紗瓏' }, lock)).toBeNull();
    expect(liveWithdrawal([notice], 11, { horseNumber: 2, nameCh: '其他馬' }, lock)).toBeNull();
  });
  it('同身份登記編號不阻截退出公告，錯身份仍不匹配', () => {
    const change = { ...notice, horseName: '龍文瑞安' };
    expect(liveWithdrawal([change], 11, { horseNumber: 2, nameCh: '龍文瑞安 (L029)', horseId: 'horse_L029' }, lock)).toMatchObject({ kind: 'scratched', beforeLock: false });
    expect(liveWithdrawal([change], 11, { horseNumber: 2, nameCh: '龍文瑞安 (L029)', horseId: 'horse_L030' }, lock)).toBeNull();
  });
});