import { describe, it, expect } from 'vitest';
import { effectiveTop4 } from './withdrawal-substitution';

const lockAt = '2026-10-19T03:00:00Z';
const five = (out?: number, announcedAtIso: string | null = '2026-10-19T03:01:00Z') => [1, 2, 3, 4, 5].map(n => ({ horseNumber: n, rank: n, withdrawn: n === out, announcedAtIso }));

describe('退出後按引擎順位補上', () => {
  it('4號退出 → 1-2-3-5', () => {
    expect(effectiveTop4(five(4), lockAt).effective).toEqual([1, 2, 3, 5]);
  });
  it('1號退出 → 2-3-4-5', () => {
    const r = effectiveTop4(five(1), lockAt);
    expect(r.effective).toEqual([2, 3, 4, 5]);
    expect(r.removed).toEqual([1]);
    expect(r.added).toEqual([5]);
  });
  it('四揀以外退出唔影響', () => {
    expect(effectiveTop4(five(5), lockAt)).toMatchObject({ effective: [1, 2, 3, 4], substituted: false });
  });
  it('原凍結四揀保持不變', () => {
    expect(effectiveTop4(five(2), lockAt).original).toEqual([1, 2, 3, 4]);
  });
  it('R8 白鷺金剛15/10退出不能補位', () => {
    expect(effectiveTop4(five(4, '2026-10-15T09:04:00Z'), lockAt)).toMatchObject({status:'invalid-prelock-input',effective:[],added:[],substituted:false,original:[1,2,3,4]});
  });
  it('R10 活力拍檔18/10換馬不能補位', () => {
    expect(effectiveTop4(five(1, '2026-10-18T02:03:00Z'), lockAt)).toMatchObject({status:'invalid-prelock-input',effective:[],added:[],substituted:false});
  });
  it('等於鎖點不是鎖後退出', () => {
    expect(effectiveTop4(five(4, lockAt), lockAt).status).toBe('invalid-prelock-input');
  });
  it('缺官方時間不能估作鎖後退出', () => {
    expect(effectiveTop4(five(4, null), lockAt)).toMatchObject({status:'unverified-change-timing',effective:[],substituted:false});
  });
  it('四揀以外鎖前退出亦表示整場用錯輸入', () => {
    expect(effectiveTop4(five(5, '2026-10-18T02:03:00Z'), lockAt).status).toBe('invalid-prelock-input');
  });
  it('混合鎖前鎖後退出不准部分補位', () => {
    const picks = five(4).map(p => p.horseNumber === 1 ? {...p,withdrawn:true,announcedAtIso:'2026-10-18T02:03:00Z'} : p);
    expect(effectiveTop4(picks, lockAt)).toMatchObject({status:'invalid-prelock-input',effective:[],added:[],substituted:false});
  });
});
