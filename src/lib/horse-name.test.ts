import { describe, expect, it } from 'vitest';
import { horseDisplayDto, horseDisplayName } from './horse-name';

describe('馬名與登記身份', () => {
  it('龍文瑞安 L029 只移除同一身份嘅附加登記編號', () => {
    expect(horseDisplayName('龍文瑞安 (L029)', 'horse_L029')).toBe('龍文瑞安');
    expect(horseDisplayName('龍文瑞安（L029）', 'horse_L029')).toBe('龍文瑞安');
    expect(horseDisplayName('龍文瑞安 (L029)', 'horse_K307')).toBe('龍文瑞安 (L029)');
    expect(horseDisplayName('龍文瑞安 (L029)')).toBe('龍文瑞安 (L029)');
  });
  it('保留原始來源、身份、分數及合法馬名括號', () => {
    const source = { picks: [{ horseId: 'horse_L029', nameCh: '龍文瑞安 (L029)', finalScore: 1420.1, rank: 11 }] };
    const display = horseDisplayDto(source);
    expect(display.picks[0]).toEqual({ horseId: 'horse_L029', nameCh: '龍文瑞安', finalScore: 1420.1, rank: 11 });
    expect(source.picks[0]?.nameCh).toBe('龍文瑞安 (L029)');
    expect(horseDisplayName('馬名（香港）', 'horse_L029')).toBe('馬名（香港）');
  });
});