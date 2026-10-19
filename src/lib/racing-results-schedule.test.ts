import { describe, expect, it } from 'vitest';
import { isConfirmedComplete, resultsDueAt, type OfficialResultMeeting } from './racing-results-schedule';

const meeting: OfficialResultMeeting = { date: '2026-10-19', venueCode: 'ST', status: 'CLOSED', totalNumberOfRace: 11, races: Array.from({ length: 11 }, (_, i) => ({ no: i + 1, status: 'RESULT' })) };
describe('全日完場後30分鐘收料', () => {
  it('首次確認完場後恰好30分鐘到期，包括跨午夜', () => {
    expect(resultsDueAt('2026-10-19T11:30:00Z')).toBe(Date.parse('2026-10-19T12:00:00Z'));
    expect(resultsDueAt('2026-10-21T15:50:00Z')).toBe(Date.parse('2026-10-21T16:20:00Z'));
  });
  it('全11場RESULT及CLOSED先確認', () => {
    expect(isConfirmedComplete(meeting)).toBe(true);
    expect(isConfirmedComplete({ ...meeting, status: 'STARTED' })).toBe(false);
  });
  it('只得前4場或尾場未完不可計時', () => {
    expect(isConfirmedComplete({ ...meeting, races: meeting.races.slice(0, 4) })).toBe(false);
    expect(isConfirmedComplete({ ...meeting, races: meeting.races.map(r => r.no === 11 ? { ...r, status: 'STARTED' } : r) })).toBe(false);
  });
  it('重複場號及放棄賽事不可冒稱正常完場', () => {
    expect(isConfirmedComplete({ ...meeting, races: meeting.races.map(r => ({ ...r, no: 1 })) })).toBe(false);
    expect(isConfirmedComplete({ ...meeting, status: 'ABANDON_PARTIAL' })).toBe(false);
  });
});