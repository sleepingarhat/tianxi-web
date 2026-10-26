import { describe, expect, it } from 'vitest';
import {
  NOTIFY_DISCLAIMER,
  acceptsNotifyEvent,
  isDeliverableTop4,
  notifyEventMessage,
  type NotifyFeedEvent,
} from './notify-events';

const prefsOn = { lock_complete_enabled: true, top4_lock_enabled: true, daily_pnl_enabled: true };

describe('notify-events rules', () => {
  it('non-Pro never accepts', () => {
    expect(acceptsNotifyEvent('lock_complete', prefsOn, false)).toBe(false);
    expect(acceptsNotifyEvent('top4_lock', prefsOn, false)).toBe(false);
    expect(acceptsNotifyEvent('daily_pnl', prefsOn, false)).toBe(false);
  });

  it('Pro respects per-type prefs', () => {
    expect(acceptsNotifyEvent('lock_complete', prefsOn, true)).toBe(true);
    expect(acceptsNotifyEvent('top4_lock', { ...prefsOn, top4_lock_enabled: false }, true)).toBe(false);
    expect(acceptsNotifyEvent('daily_pnl', { ...prefsOn, daily_pnl_enabled: false }, true)).toBe(false);
  });

  it('draft top4 is not deliverable', () => {
    const draft: NotifyFeedEvent = {
      event_key: 'top4_lock:2026-10-26:ST:1:horse_J062',
      type: 'top4_lock',
      created_at: '2026-10-26T04:00:00Z',
      payload: { edition: 'draft' },
    };
    expect(isDeliverableTop4(draft)).toBe(false);
    expect(isDeliverableTop4({ ...draft, payload: {} })).toBe(true);
  });

  it('messages always include disclaimer and never hit-rate/ROI marketing', () => {
    const lock = notifyEventMessage({
      event_key: 'lock_complete:2026-10-26:ST:v12',
      type: 'lock_complete',
      created_at: 'x',
      payload: { date: '2026-10-26', venue: 'ST' },
    });
    expect(lock.text).toContain(NOTIFY_DISCLAIMER);
    expect(lock.text).not.toMatch(/必中|穩膽|命中率|回報/);

    const pnl = notifyEventMessage({
      event_key: 'daily_pnl:2026-10-05:HV:v12',
      type: 'daily_pnl',
      created_at: 'x',
      payload: { date: '2026-10-05', venue: 'HV', net: -430, racesBet: 1 },
    });
    expect(pnl.text).toContain('-$430');
    expect(pnl.text).toContain(NOTIFY_DISCLAIMER);
    expect(pnl.text).not.toMatch(/命中率|ROI|回報％/);
  });

  it('top4 message names the horse', () => {
    const msg = notifyEventMessage({
      event_key: 'top4_lock:2026-10-26:ST:1:horse_J062',
      type: 'top4_lock',
      horse_id: 'horse_J062',
      created_at: 'x',
      payload: { date: '2026-10-26', venue: 'ST', raceNumber: 1, horseNumber: 5, nameCh: '金鑽貴人' },
    });
    expect(msg.text).toContain('金鑽貴人');
    expect(msg.text).toContain('第1場');
  });
});
