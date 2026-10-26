import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), archive: vi.fn(), sync: vi.fn(), date: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock('@/integrations/supabase/cron-auth', () => ({ authenticateCronRequest: mocks.auth }));
vi.mock('@/lib/weather-archive.server', () => ({ runWeatherArchive: mocks.archive }));
vi.mock('@/lib/weather-sync-github.server', () => ({ syncWeatherDate: mocks.sync, hkDateStr: mocks.date }));
import { Route as archiveRoute } from '@/routes/api/public/jobs/weather-archive';
import { Route as syncRoute } from '@/routes/api/public/jobs/weather-sync-github';
import { Route as legacyArchive } from '@/routes/api/public/weather-archive';
import { Route as legacySync } from '@/routes/api/public/weather-sync-github';

type PostRoute = { server: { handlers: { POST: (args: { request: Request }) => Promise<Response> } } };
const post = (route: unknown, path: string) => (route as PostRoute).server.handlers.POST({
  request: new Request(`https://tianxi.racing${path}`, { method: 'POST' }),
});
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });

describe('天氣平台排程入口', () => {
  it.each([
    ['存檔', archiveRoute, '/api/public/jobs/weather-archive'],
    ['同步', syncRoute, '/api/public/jobs/weather-sync-github'],
    ['舊同步', legacySync, '/api/public/weather-sync-github'],
  ])('%s未授權不能執行工作', async (_, route, path) => {
    mocks.auth.mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    expect((await post(route, path)).status).toBe(401);
    expect(mocks.archive).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it('平台存檔不允許force跳過賽日時窗', async () => {
    mocks.auth.mockResolvedValue(null);
    mocks.archive.mockResolvedValue(Response.json({ ok: true, saved: 0, skipped: '無賽事' }));
    const response = await post(archiveRoute, '/api/public/jobs/weather-archive?force=1');
    expect(response.status).toBe(200);
    expect(mocks.archive).toHaveBeenCalledExactlyOnceWith('https://tianxi.racing');
    expect((await response.json()).saved).toBe(0);
  });
  it.each([syncRoute, legacySync])('新舊同步只用香港當日，不接受改日期', async (route) => {
    mocks.auth.mockResolvedValue(null);
    mocks.date.mockReturnValue('2026-10-24');
    mocks.sync.mockResolvedValue({ ok: true, date: '2026-10-24', rows: 0, skipped: '當日無天氣存檔' });
    const response = await post(route, '/api/public/weather-sync-github?date=2020-01-01');
    expect(response.status).toBe(200);
    expect(mocks.sync).toHaveBeenCalledExactlyOnceWith('2026-10-24');
  });
  it.each([
    ['存檔', legacyArchive, '/api/public/weather-archive'],
  ])('原%s入口保留舊驗證，不能使用平台驗證繞過', async (_, route, path) => {
    expect((await post(route, path)).status).toBe(401);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.archive).not.toHaveBeenCalled();
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it('舊同步拒絕共享天氣header且不執行工作', async () => {
    vi.stubEnv('WEATHER_CRON_SECRET', 'test-old-weather');
    mocks.auth.mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    const response = await (legacySync as unknown as PostRoute).server.handlers.POST({
      request: new Request('https://tianxi.racing/api/public/weather-sync-github', {
        method: 'POST', headers: { 'x-cron-secret': 'test-old-weather' },
      }),
    });
    expect(response.status).toBe(401);
    expect(mocks.sync).not.toHaveBeenCalled();
  });
});