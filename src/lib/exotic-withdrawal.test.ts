import { describe, expect, it } from 'vitest';
import { settleWithdrawnLeg } from './exotic-withdrawal';

const leg = { race: 5, bankers: [3, 7], legs: [1, 9, 12] };

describe('孖T／三T原票退出替補（Rule 3.10(b)(iii)）', () => {
  it('冇退出就原票不變', () => {
    expect(settleWithdrawnLeg(leg, new Set([4]), [2]).status).toBe('unchanged');
  });
  it('缺官方熱門證據即待核，唔當退款或落敗', () => {
    expect(settleWithdrawnLeg(leg, new Set([9]), null).status).toBe('pending');
  });
  it('用官方熱門替補，略過已選馬匹', () => {
    const r = settleWithdrawnLeg(leg, new Set([9]), [3, 1, 6, 2]);
    expect(r.status).toBe('substituted');
    expect(r.leg.legs).toEqual([1, 6, 12]);
    expect(r.leg.bankers).toEqual([3, 7]);
  });
  it('膽拖退出亦由熱門替補', () => {
    const r = settleWithdrawnLeg(leg, new Set([7]), [5]);
    expect(r.leg.bankers).toEqual([3, 5]);
  });
  it('熱門唔夠替補就待核', () => {
    expect(settleWithdrawnLeg(leg, new Set([9, 12]), [3, 6]).status).toBe('pending');
  });
});
