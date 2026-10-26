import { describe, expect, it } from 'vitest';
import { JOB_TICK_WATCHES, jobTickKey, makeJobTick } from './job-ticks';
import { jobTickCheck, runJobTickAlertsWith, type JobTickAlertStore } from './job-ticks-watch.server';

const WATCH = JOB_TICK_WATCHES[0]!;

function fakeStore(initial: Record<string, unknown> = {}) {
  const state = new Map<string, unknown>(Object.entries(initial));
  const sent: string[] = [];
  const store: JobTickAlertStore = {
    read: async key => state.get(key) ?? null,
    write: async (key, value) => {
      state.set(key, value);
    },
    send: async text => {
      sent.push(text);
      return { sent: true };
    },
  };
  return { state, sent, store };
}

describe('job-ticks-watch', () => {
  it('watches the dividends heartbeat with a 30-minute budget', () => {
    expect(WATCH.job).toBe('racing-dividends');
    expect(WATCH.maxAgeMs).toBe(30 * 60_000);
    expect(jobTickKey(WATCH.job)).toBe('job_tick:racing-dividends');
  });

  it('treats fresh ok and fail ticks as alive — per-run failures use the dividends alert chain', () => {
    const now = new Date('2026-10-26T12:00:00Z');
    const ok = jobTickCheck(makeJobTick('racing-dividends', 'ok', {}, new Date('2026-10-26T11:50:00Z')), WATCH, now);
    expect(ok.fail).toBeNull();
    const failed = jobTickCheck(makeJobTick('racing-dividends', 'fail', {}, new Date('2026-10-26T11:50:00Z')), WATCH, now);
    expect(failed.fail).toBeNull();
  });

  it('alerts on stale and missing heartbeats with the job label', () => {
    const now = new Date('2026-10-26T12:00:00Z');
    const stale = jobTickCheck(makeJobTick('racing-dividends', 'ok', {}, new Date('2026-10-26T11:00:00Z')), WATCH, now);
    expect(stale.fail).toContain('官方派彩自動核對');
    expect(stale.fail).toContain('60 分鐘');
    const missing = jobTickCheck(null, WATCH, now);
    expect(missing.fail).toContain('從未寫入');
  });

  it('alerts once per 12h and sends a recovery notice after delivery', async () => {
    const staleTick = makeJobTick('racing-dividends', 'ok', {}, new Date('2026-10-26T11:00:00Z'));
    const freshTick = makeJobTick('racing-dividends', 'ok', {}, new Date('2026-10-26T12:10:00Z'));
    const { state, sent, store } = fakeStore({ 'job_tick:racing-dividends': staleTick });

    const first = await runJobTickAlertsWith(store, new Date('2026-10-26T12:00:00Z'));
    expect(first.sent).toBe(true);
    expect(sent[0]).toContain('停滯');

    const second = await runJobTickAlertsWith(store, new Date('2026-10-26T12:05:00Z'));
    expect(second.sent).toBe(false);
    expect(second.failing).toHaveLength(1);
    expect(sent).toHaveLength(1);

    state.set('job_tick:racing-dividends', freshTick);
    const third = await runJobTickAlertsWith(store, new Date('2026-10-26T12:10:00Z'));
    expect(third.sent).toBe(true);
    expect(sent[1]).toContain('已恢復');
    expect(sent[1]).toContain('官方派彩自動核對');
    expect(state.get('alert:job_tick:racing-dividends')).toEqual({ fail: null, sent_at: null });
  });

  it('keeps the old sent_at when delivery fails so the next run retries', async () => {
    const staleTick = makeJobTick('racing-dividends', 'ok', {}, new Date('2026-10-26T11:00:00Z'));
    const state = new Map<string, unknown>([['job_tick:racing-dividends', staleTick]]);
    const sent: string[] = [];
    const store: JobTickAlertStore = {
      read: async key => state.get(key) ?? null,
      write: async (key, value) => {
        state.set(key, value);
      },
      send: async text => {
        sent.push(text);
        return { sent: false };
      },
    };
    const result = await runJobTickAlertsWith(store, new Date('2026-10-26T12:00:00Z'));
    expect(result.sent).toBe(false);
    // 發送失敗不寫入，舊狀態原封不動，下一輪照樣重試。
    expect(state.get('alert:job_tick:racing-dividends')).toBeUndefined();
    const retry = await runJobTickAlertsWith(store, new Date('2026-10-26T12:05:00Z'));
    expect(retry.sent).toBe(false);
    expect(sent).toHaveLength(2);
    expect(state.get('alert:job_tick:racing-dividends')).toBeUndefined();
  });
});

describe('job tick recovery alignment', () => {
  it('passing clears state even after 12h+ and failed send', async () => {
    const { runJobTickAlertsWith } = await import('./job-ticks-watch.server');
    const now = new Date('2026-10-26T12:00:00Z');
    const w: Record<string, unknown> = {
      'job_tick:racing-dividends': makeJobTick('racing-dividends', 'ok', {}, new Date('2026-10-26T11:55:00Z')),
      'alert:job_tick:racing-dividends': { fail: 'x', sent_at: '2026-10-25T20:00:00Z' },
    };
    const writes: string[] = [];
    const r = await runJobTickAlertsWith({ read: async k => w[k] ?? null, write: async k => { writes.push(k); }, send: async () => ({ sent: false }) }, now);
    expect(r.sent).toBe(false);
    expect(writes).toContain('alert:job_tick:racing-dividends');
  });
});
