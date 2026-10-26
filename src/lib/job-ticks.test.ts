import { describe, expect, it } from 'vitest';
import {
  isJobTickStale,
  isLocalVenue,
  jobTickKey,
  makeJobTick,
  parseJobTick,
} from './job-ticks';

describe('job-ticks', () => {
  it('filters local venues ST/HV only', () => {
    expect(isLocalVenue('ST')).toBe(true);
    expect(isLocalVenue('hv')).toBe(true);
    expect(isLocalVenue('S1')).toBe(false);
    expect(isLocalVenue('NY')).toBe(false);
  });

  it('builds and parses tick payloads', () => {
    const t = makeJobTick('racing-dividends', 'ok', { rows: 12 }, new Date('2026-10-26T12:00:00Z'));
    expect(t).toEqual({
      job: 'racing-dividends',
      status: 'ok',
      at: '2026-10-26T12:00:00.000Z',
      meta: { rows: 12 },
    });
    expect(parseJobTick(t)?.job).toBe('racing-dividends');
    expect(parseJobTick({ job: 'x' })).toBeNull();
    expect(jobTickKey('racing-dividends')).toBe('job_tick:racing-dividends');
  });

  it('detects stale / fail / missing', () => {
    const now = new Date('2026-10-26T12:00:00Z');
    const fresh = makeJobTick('j', 'ok', {}, new Date('2026-10-26T11:50:00Z'));
    const old = makeJobTick('j', 'ok', {}, new Date('2026-10-26T10:00:00Z'));
    const fail = makeJobTick('j', 'fail', {}, new Date('2026-10-26T11:59:00Z'));
    expect(isJobTickStale(fresh, 30 * 60_000, now)).toBe(false);
    expect(isJobTickStale(old, 30 * 60_000, now)).toBe(true);
    expect(isJobTickStale(fail, 30 * 60_000, now)).toBe(true);
    expect(isJobTickStale(null, 30 * 60_000, now)).toBe(true);
  });
});
