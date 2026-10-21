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
  it('逐張三匹原票替補，不因其他拖腳已選熱門而略過', () => {
    const r = settleWithdrawnLeg(leg, new Set([9]), [3, 1, 6, 2]);
    expect(r.status).toBe('substituted');
    expect(r.leg.legs).toEqual([1, 1, 12]);
    expect(r.combinations).toEqual([[3,7,1],[3,7,1],[3,7,12]]);
    expect(r.leg.bankers).toEqual([3, 7]);
  });
  it('膽拖退出亦由熱門替補', () => {
    const r = settleWithdrawnLeg(leg, new Set([7]), [5]);
    expect(r.leg.bankers).toEqual([3, 5]);
  });
  it('熱門唔夠替補就待核', () => {
    expect(settleWithdrawnLeg(leg, new Set([7, 9]), [3, 6]).status).toBe('pending');
  });
  it('同一原票兩匹退出用首兩匹未選熱門，保留未受影響注項', () => {
    const r = settleWithdrawnLeg(leg, new Set([7,9]), [3,1,6,2]);
    expect(r.combinations).toEqual([[3,6,1],[3,1,6],[3,1,12]]);
    expect(leg).toEqual({race:5,bankers:[3,7],legs:[1,9,12]});
  });
});
