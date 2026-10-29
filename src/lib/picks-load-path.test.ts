import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ frozen: vi.fn(), identity: vi.fn() }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
vi.mock('./frozen-racing.server', () => ({ readFrozenRacing: mocks.frozen }));
vi.mock('./public-racing-evidence.server', () => ({ publicRacingQuery: mocks.identity }));
import { fetchTodayPicksUpstream } from './picks.functions';
import { FrozenEvidenceError } from './frozen-racing';

const frozen = { date: '2026-10-28', venue: 'ST', edition: 'final', races: [{ raceNumber: 1 }] };
let requests: string[];
function responses(lock: unknown, meeting: unknown, live: unknown = { noMeeting: true, races: [] }) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    requests.push(url);
    if (url.endsWith('/lock-state')) return Response.json(lock);
    if (url.endsWith('/smart/current')) return Response.json(meeting);
    if (url.endsWith('/today-picks')) return Response.json(live);
    throw new Error('Unexpected request');
  }));
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-29T05:19:00Z'));
  vi.resetAllMocks(); requests = []; mocks.frozen.mockResolvedValue(frozen);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('上一賽日快讀仍核實原始凍結副本', () => {
  it('28/10沙田直接讀副本，不讀即時預測及其身份表', async () => {
    responses({ locked: false, source: 'no-fixture' }, { date: '2026-10-28', venue: 'ST' });
    expect(await fetchTodayPicksUpstream()).toEqual(frozen);
    expect(mocks.frozen).toHaveBeenCalledWith('2026-10-28');
    expect(requests.some(url => url.endsWith('/today-picks'))).toBe(false);
    expect(mocks.identity).not.toHaveBeenCalled();
  });
  it('副本核實失敗不可退回即時重算版', async () => {
    responses({ locked: false }, { date: '2026-10-28', venue: 'ST' });
    mocks.frozen.mockRejectedValue(new FrozenEvidenceError('verification-failed', 'SHA mismatch'));
    await expect(fetchTodayPicksUpstream()).rejects.toThrow('SHA mismatch');
    expect(requests.some(url => url.endsWith('/today-picks'))).toBe(false);
  });
  it('賽程與副本馬場不符仍阻截', async () => {
    responses({ locked: false }, { date: '2026-10-28', venue: 'HV' });
    await expect(fetchTodayPicksUpstream()).rejects.toThrow('馬場不符');
  });
  it('下一賽日入料不可強留上一賽日', async () => {
    responses({ locked: false }, { date: '2026-11-01', venue: 'ST' });
    await fetchTodayPicksUpstream();
    expect(requests.some(url => url.endsWith('/today-picks'))).toBe(true);
    expect(mocks.frozen).not.toHaveBeenCalled();
  });
  it('已鎖當日仍按lock-state日期核實，不讀賽程定位或即時版', async () => {
    responses({ locked: true, date: '2026-10-29', venue: 'ST' }, {});
    await fetchTodayPicksUpstream();
    expect(mocks.frozen).toHaveBeenCalledWith('2026-10-29');
    expect(requests).toHaveLength(1);
  });
  it('賽程定位失敗保留原有讀取，舊日期直接轉副本', async () => {
    responses({ locked: false }, {}, { date: '2026-10-28', venue: 'ST', races: [{ raceNumber: 1 }] });
    expect(await fetchTodayPicksUpstream()).toEqual(frozen);
    expect(mocks.identity).not.toHaveBeenCalled();
  });
});