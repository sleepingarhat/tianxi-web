import { afterEach, describe, expect, it, vi } from 'vitest';
import { alertHookSecrets, legacyFallbackEnabled, secretMatches, watchFeedSenderSecret, weatherHookSecrets } from './shared-secret.server';

afterEach(() => { vi.unstubAllEnvs(); });

describe('共享密鑰（一個用途一個密鑰）', () => {
  it('常數時間比較：正確值通過、錯值／空值拒絕', () => {
    expect(secretMatches('a', ['b', 'a'])).toBe(true);
    expect(secretMatches('a', ['b'])).toBe(false);
    expect(secretMatches('', ['a'])).toBe(false);
    expect(secretMatches('a', [undefined, ''])).toBe(false);
  });
  it('telegram-alert：專用值＋PREVIOUS，過渡期接受舊共用值', () => {
    vi.stubEnv('ALERT_HOOK_SECRET', 'alert-new');
    vi.stubEnv('ALERT_HOOK_SECRET_PREVIOUS', 'alert-old');
    vi.stubEnv('WEATHER_CRON_SECRET', 'legacy');
    expect(alertHookSecrets()).toEqual(['alert-new', 'alert-old', 'legacy']);
    vi.stubEnv('LEGACY_CRON_SECRET_FALLBACK', 'off');
    expect(legacyFallbackEnabled()).toBe(false);
    expect(alertHookSecrets()).toEqual(['alert-new', 'alert-old']);
  });
  it('天氣／賽果 hooks 支援 WEATHER_CRON_SECRET_PREVIOUS 零停機輪換', () => {
    vi.stubEnv('WEATHER_CRON_SECRET', 'w-new');
    vi.stubEnv('WEATHER_CRON_SECRET_PREVIOUS', 'w-old');
    expect(weatherHookSecrets()).toEqual(['w-new', 'w-old']);
  });
  it('愛駒 feed 發送：優先 WATCH_FEED_SECRET；fallback 關咗唔再用舊共用值', () => {
    vi.stubEnv('WEATHER_CRON_SECRET', 'legacy');
    expect(watchFeedSenderSecret()).toBe('legacy');
    vi.stubEnv('WATCH_FEED_SECRET', 'feed');
    expect(watchFeedSenderSecret()).toBe('feed');
    vi.stubEnv('WATCH_FEED_SECRET', '');
    vi.stubEnv('LEGACY_CRON_SECRET_FALLBACK', 'off');
    expect(watchFeedSenderSecret()).toBeUndefined();
  });
});
