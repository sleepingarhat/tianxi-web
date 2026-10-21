import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseHkjcChanges, officialWithdrawal, unnumberedPrelockWithdrawal } from './hkjc-changes';

const html = readFileSync('docs/evidence/hkjc-2026-10-19/changes.html', 'utf8');
const changes = parseHkjcChanges(html);

describe('HKJC 2026-10-19 official changes', () => {
  it('21/10 R9風將L184無馬號無名次，唯一鎖前公告解釋退出；傲聖不可套用', () => {
    const c = { raceNumber: 9, horseNumber: 8, horseName: '風將', kind: 'replaced' as const, replacement: '傲聖', text: '退出競賽', announcedAt: '19/10 18:11', announcedAtIso: '2026-10-19T10:11:00.000Z' };
    const r = { raceNumber: 9, horseNumber: null, horseId: 'horse_L184', finishingPosition: null };
    const lock = '2026-10-21T09:10:00.000Z';
    expect(unnumberedPrelockWithdrawal([c], r, '風將', lock)).toBe(c);
    expect(unnumberedPrelockWithdrawal([c], r, '傲聖', lock)).toBeUndefined();
    expect(officialWithdrawal([c],9,8,'傲聖','horse_L384')).toBeUndefined();
    expect(unnumberedPrelockWithdrawal([c], {...r,raceNumber:10}, '風將', lock)).toBeUndefined();
    expect(unnumberedPrelockWithdrawal([c], {...r,finishingPosition:1}, '風將', lock)).toBeUndefined();
    expect(unnumberedPrelockWithdrawal([c,c], r, '風將', lock)).toBeUndefined();
    expect(unnumberedPrelockWithdrawal([c], r, '風將', '2026-10-18T09:10:00.000Z')).toBeUndefined();
  });
  it('R10 H3 活力拍檔 replaced by 風將 at 18/10 10:03', () => {
    const c = changes.find(c => c.raceNumber === 10 && c.horseName === '活力拍檔');
    expect(c).toMatchObject({ horseNumber: 3, kind: 'replaced', replacement: '風將', announcedAt: '18/10 10:03' });
  });
  it('R8 H4 白鷺金剛 scratched at 15/10 17:04', () => {
    expect(changes.find(c => c.raceNumber === 8 && c.horseNumber === 4)).toMatchObject({ horseName: '白鷺金剛', kind: 'scratched', announcedAt: '15/10 17:04' });
  });
  it('登記編號唔會令同馬退出公告失配，錯身份仍不套用', () => {
    const notices = [{ raceNumber: 1, horseNumber: 5, horseName: '龍文瑞安', kind: 'scratched' as const, replacement: null, text: '退出競賽', announcedAt: '20/10 09:06', announcedAtIso: null }];
    expect(officialWithdrawal(notices, 1, 5, '龍文瑞安 (L029)', 'horse_L029')?.kind).toBe('scratched');
    expect(officialWithdrawal(notices, 1, 5, '龍文瑞安 (L029)', 'horse_K307')).toBeUndefined();
  });
});
