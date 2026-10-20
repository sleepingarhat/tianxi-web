import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseHkjcChanges, officialWithdrawal } from './hkjc-changes';

const html = readFileSync('docs/evidence/hkjc-2026-10-19/changes.html', 'utf8');
const changes = parseHkjcChanges(html);

describe('HKJC 2026-10-19 official changes', () => {
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
