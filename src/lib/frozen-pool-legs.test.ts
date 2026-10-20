import { describe, expect, it } from 'vitest';
import { frozenPoolLegs, type FrozenPoolRace } from './frozen-pool-legs';
import { deriveOfficialFavourites, favouriteOrderForSettlement } from './official-favourites';
import { settleWithdrawnLeg } from './exotic-withdrawal';

const race = (ns: number[], status = 'valid'): FrozenPoolRace => ({ raceNumber: 9,
  metricInput: { status }, picks: ns.map((horseNumber, i) => ({ horseNumber, rank: i + 1 })) });
describe('跨場只讀原凍結五選', () => {
  it('19日R9保留原五選1、10、7、3、2，不用補位四揀', () => {
    expect(frozenPoolLegs([race([1, 10, 7, 3, 2])])[9]).toEqual({ race: 9, bankers: [1, 10], legs: [7, 3, 2], fifthFromLive: false });
  });
  it('缺第五選停止結算，不讀賽後補選', () => {
    expect(frozenPoolLegs([race([1, 10, 7, 3])])[9]).toBeNull();
  });
  it('鎖前無效原票不計正式跨場成本派彩', () => {
    expect(frozenPoolLegs([race([2, 4, 10, 7, 9], 'invalid-prelock-input')])[9]).toBeNull();
  });
  it('19日R9金金小子退出：以官方第二熱門8替補7，略過已選1及10', () => {
    const leg = frozenPoolLegs([race([1, 10, 7, 3, 2])])[9];
    if (!leg) throw new Error('fixture requires five frozen picks');
    const odds = [[1,3],[8,3.4],[10,5.3],[2,7.9],[6,9.3],[11,16],[3,32],[5,37],[12,44],[4,70],[9,119]];
    const evidence = deriveOfficialFavourites(9, odds.map(([horseNumber, winOdds]) => ({ raceNumber:9, horseNumber:horseNumber ?? 0, winOdds:winOdds ?? null, finishingPosition:1 })), {
      sourceUrl:'https://racing.hkjc.com/racing/information/Chinese/Racing/LocalResults.aspx?RaceDate=2026/10/19&Racecourse=ST&RaceNo=9',
      sha256:'a7d9bcadecdb526a1b055c096bcc238868657377265d7ddab05a00b7a71d8549', fetchedAt:'2026-10-19T13:20:00Z',
    });
    const settled = settleWithdrawnLeg(leg, new Set([7]), favouriteOrderForSettlement(evidence));
    expect(settled.status).toBe('substituted');
    expect(settled.leg).toMatchObject({ bankers:[1,10], legs:[8,3,2] });
    expect(leg.legs).toEqual([7,3,2]);
  });
});