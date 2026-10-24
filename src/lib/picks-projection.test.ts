import { describe, expect, it } from 'vitest';
import { proEnforcementEnabled, projectDayPicksForViewer } from './picks-projection';
import type { DayPicks } from './racing-shapes';

const pick = (rank: number) => ({ rank, horseNumber: rank, nameCh: `馬${rank}` });
const day: DayPicks = { date: '2026-10-25', venue: 'ST', races: [
  { raceNumber: 1, picks: [pick(1), pick(2), pick(3), pick(4)] },
  { raceNumber: 2, picks: [pick(1), pick(2), pick(3), pick(4)] },
  { raceNumber: 3, settled: true, picks: [pick(1), pick(2), pick(3), pick(4)] },
] } as DayPicks;

describe('全日預測伺服器投影（PRO_ENFORCEMENT）', () => {
  it('預設關閉', () => {
    expect(proEnforcementEnabled({})).toBe(false);
    expect(proEnforcementEnabled({ PRO_ENFORCEMENT: 'off' })).toBe(false);
    expect(proEnforcementEnabled({ PRO_ENFORCEMENT: 'on' })).toBe(true);
  });
  it('Pro 原封不動', () => {
    expect(projectDayPicksForViewer(day, 'pro')).toBe(day);
  });
  it('非 Pro：第一場及已完賽全數，其餘只得首選；唔改原物件', () => {
    for (const tier of ['guest', 'registered'] as const) {
      const out = projectDayPicksForViewer(day, tier);
      expect(out.races?.[0]?.picks).toHaveLength(4);
      expect(out.races?.[1]?.picks).toEqual([pick(1)]);
      expect(out.races?.[2]?.picks).toHaveLength(4);
    }
    expect(day.races?.[1]?.picks).toHaveLength(4);
  });
});
