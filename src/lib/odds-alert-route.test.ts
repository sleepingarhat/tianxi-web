import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock('@/lib/telegramAlert.server', () => ({ sendTelegramAlert: mocks.send, runAlertChecks: vi.fn() }));
import { Route } from '@/routes/api/public/telegram-alert';
const post = (Route as unknown as { server: { handlers: { POST: (i: { request: Request }) => Promise<Response> } } }).server.handlers.POST;
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe('市場盤口告警', () => {
  it('未送達回503，不能當成功去重', async () => {
    vi.stubEnv('WEATHER_CRON_SECRET', 'test-only');
    mocks.send.mockResolvedValue({ sent: false });
    const response = await post({ request: new Request('http://localhost/api/public/telegram-alert', { method: 'POST', headers: { 'content-type': 'application/json', 'x-cron-secret': 'test-only' }, body: JSON.stringify({ kind: 'odds-stale', date: '2026-10-21', races: [1, 9] }) }) });
    expect(response.status).toBe(503);
    expect((await response.json()).sent).toBe(false);
  });
  it('沒有驗證不可派送', async () => {
    vi.stubEnv('WEATHER_CRON_SECRET', 'test-only');
    const response = await post({ request: new Request('http://localhost/api/public/telegram-alert', { method: 'POST' }) });
    expect(response.status).toBe(401);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('ALERT_HOOK_SECRET 可派送；fallback 關咗之後舊共用值 401', async () => {
    vi.stubEnv('ALERT_HOOK_SECRET', 'alert-only');
    vi.stubEnv('WEATHER_CRON_SECRET', 'legacy-only');
    mocks.send.mockResolvedValue({ sent: true });
    const req = (secret: string) => new Request('http://localhost/api/public/telegram-alert', { method: 'POST', headers: { 'content-type': 'application/json', 'x-cron-secret': secret }, body: JSON.stringify({ kind: 'odds-stale', date: '2026-10-25', races: [1] }) });
    expect((await post({ request: req('alert-only') })).status).toBe(200);
    expect((await post({ request: req('legacy-only') })).status).toBe(200);
    vi.stubEnv('LEGACY_CRON_SECRET_FALLBACK', 'off');
    expect((await post({ request: req('legacy-only') })).status).toBe(401);
    expect((await post({ request: req('alert-only') })).status).toBe(200);
  });
});
