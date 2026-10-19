import { describe, it, expect } from 'vitest';
import { effectiveTop4 } from './withdrawal-substitution';

const five = (out?: number) => [1, 2, 3, 4, 5].map(n => ({ horseNumber: n, rank: n, withdrawn: n === out }));

describe('退出後按引擎順位補上', () => {
  it('4號退出 → 1-2-3-5', () => {
    expect(effectiveTop4(five(4)).effective).toEqual([1, 2, 3, 5]);
  });
  it('1號退出 → 2-3-4-5', () => {
    const r = effectiveTop4(five(1));
    expect(r.effective).toEqual([2, 3, 4, 5]);
    expect(r.removed).toEqual([1]);
    expect(r.added).toEqual([5]);
  });
  it('四揀以外退出唔影響', () => {
    expect(effectiveTop4(five(5))).toMatchObject({ effective: [1, 2, 3, 4], substituted: false });
  });
  it('原凍結四揀保持不變', () => {
    expect(effectiveTop4(five(2)).original).toEqual([1, 2, 3, 4]);
  });
});
