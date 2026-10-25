import { describe, expect, it } from 'vitest';
import { evidenceIdentity, frozenEvidenceAllows } from './locked-evidence-access';

const body = { frozen: true, date: '2026-10-25', venue: 'ST', races: [1, 2].map(raceNumber => ({ raceNumber, picks: [{ horseId: 'horse_K585' }] })) };
const id = (n: number) => evidenceIdentity(`race_2026-10-25_ST_${n}`, 'horse_K585');
describe('賽前凍結解釋身份及權限', () => {
  it('賽前缺raceId可按凍結日期馬場場次及馬匹核實第一場', () => {
    expect(frozenEvidenceAllows(body, id(1), false)).toBe(true);
  });
  it('免費用戶第二場不授權', () => {
    expect(frozenEvidenceAllows(body, id(2), false)).toBe(false);
  });
  it('已核實Pro第二場授權', () => {
    expect(frozenEvidenceAllows(body, id(2), true)).toBe(true);
  });
  it('日期馬場或凍結不符拒絕', () => {
    expect(frozenEvidenceAllows({ ...body, date: '2026-10-24' }, id(1), true)).toBe(false);
    expect(frozenEvidenceAllows({ ...body, venue: 'HV' }, id(1), true)).toBe(false);
    expect(frozenEvidenceAllows({ ...body, frozen: false }, id(1), true)).toBe(false);
  });
  it('非空但不符raceId不可用相同場次兜底，馬匹不符亦拒絕', () => {
    expect(frozenEvidenceAllows({ ...body, races: [{ ...body.races[0], raceId: 'race_2026-10-24_ST_1' }] }, id(1), true)).toBe(false);
    expect(frozenEvidenceAllows(body, { ...id(1), horseId: 'horse_L001' }, true)).toBe(false);
  });
});