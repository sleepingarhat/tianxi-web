import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), collect: vi.fn(), official: vi.fn(), send: vi.fn(), indexError: false, states: new Map<string, unknown>() }));
vi.mock('@tanstack/react-router', () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock('@/integrations/supabase/cron-auth', () => ({ authenticateCronRequest: m.auth }));
vi.mock('@/lib/hkjc-dividends.server', () => ({ collectOfficialDividends: m.collect }));
vi.mock('@/lib/racing-results-official.server', () => ({ readOfficialResultMeetings: m.official }));
vi.mock('@/lib/telegramAlert.server', () => ({ sendTelegramAlert: m.send }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { from: (table: string) => {
  if (table === 'racing_result_collection_state') return { select: () => ({ order: () => ({ limit: async () => ({ error: m.indexError ? { message: 'offline' } : null, data: [{ race_date: '2026-10-19', venue: 'ST', expected_races: 11 }] }) }) }) };
  if (table === 'telegram_alert_state') return {
    select: () => ({ eq: (_column: string, key: string) => ({ maybeSingle: async () => ({ error: null, data: m.states.has(key) ? { value: m.states.get(key) } : null }) }) }),
    upsert: async (r: { key: string; value: unknown }) => { m.states.set(r.key, r.value); return { error: null }; },
  };
  throw new Error(`Unexpected table write: ${table}`);
} } }));
import { Route } from '@/routes/api/public/jobs/racing-dividends';
const post = (Route as unknown as { server: { handlers: { POST: (input: { request: Request }) => Promise<Response> } } }).server.handlers.POST;
const request = (body = { kind: 'refresh' }) => new Request('http://localhost:8080/api/public/jobs/racing-dividends', { method: 'POST', body: JSON.stringify(body) });
async function run() {
  const p = post({ request: request() });
  await vi.runAllTimersAsync();
  return p;
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-23T10:00:00Z'));
  m.states.clear(); m.indexError = false;
  m.auth.mockResolvedValue(null); m.official.mockResolvedValue({ meetings: [] }); m.send.mockResolvedValue({ sent: true });
  m.collect.mockResolvedValue({ date: '2026-10-19', venue: 'ST', rows: 177, raceCount: 11, sha256: 'abcdef1234567890' });
});
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });
describe('派彩job完整處理路徑', () => {
  it('第一次暫斷第二次成功回200及attempts=2，沒有Telegram', async () => {
    m.collect.mockRejectedValueOnce(new Error('official-dividends-503'));
    const r = await run();
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, predictionsChanged: false, outcomes: [{ ok: true, attempts: 2, rows: 177, raceCount: 11 }] });
    expect(m.collect).toHaveBeenCalledTimes(2);
    expect(m.collect).toHaveBeenCalledWith('2026-10-19', 'ST', 11);
    expect(m.send).not.toHaveBeenCalled();
  });
  it('每輪两次失敗只計一輪；第二輪告警、第三輪靜默，成功恢復一次', async () => {
    m.collect.mockRejectedValue(new Error('official-dividends-503'));
    for (let i = 1; i <= 3; i++) {
      const r = await run();
      expect(r.status).toBe(502);
      expect(await r.json()).toMatchObject({ ok: false, predictionsChanged: false, outcomes: [{ date: '2026-10-19', error: 'official-dividends-503', attempts: 2 }] });
      expect(m.states.get('dividends:2026-10-19:ST')).toMatchObject({ failures: i });
      expect(m.send).toHaveBeenCalledTimes(i === 1 ? 0 : 1);
    }
    expect(m.send).toHaveBeenCalledWith('⚠️ 官方派彩自動核對未齊：2026-10-19（official-dividends-503）；保留上次存證，五分鐘後自動重試。');
    m.collect.mockResolvedValue({ date: '2026-10-19', venue: 'ST', rows: 177, raceCount: 11, sha256: 'abcdef1234567890' });
    expect((await run()).status).toBe(200);
    expect((await run()).status).toBe(200);
    expect(m.send).toHaveBeenCalledTimes(2);
    expect(m.send).toHaveBeenLastCalledWith('✅ 官方派彩自動核對已恢復：2026-10-19 ST，177 行／11 場，SHA abcdef12');
    expect(m.states.get('dividends:2026-10-19:ST')).toMatchObject({ failures: 0, alertedAt: null });
  });
  it('外層index失敗回502，第二輪才告警，恢復後通知', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    m.indexError = true;
    expect((await run()).status).toBe(502);
    expect(m.send).not.toHaveBeenCalled();
    const r = await run();
    expect(r.status).toBe(502);
    expect(await r.json()).toMatchObject({ ok: false, outcomes: [], predictionsChanged: false });
    expect(m.states.get('dividends:job')).toMatchObject({ failures: 2 });
    expect(m.send).toHaveBeenCalledWith('⚠️ 官方派彩自動核對工作失敗（dividend-meeting-index-failed）');
    m.indexError = false;
    expect((await run()).status).toBe(200);
    expect(m.send).toHaveBeenLastCalledWith('✅ 官方派彩自動核對工作已恢復');
    vi.restoreAllMocks();
  });
  it('official discovery拋錯亦記外層job並去重', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    m.official.mockRejectedValue(new Error('TimeoutError'));
    await run(); await run(); await run();
    expect(m.states.get('dividends:job')).toMatchObject({ failures: 3, lastError: 'TimeoutError' });
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(m.collect).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
  it('認證及body驗證保持不變', async () => {
    m.auth.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));
    expect((await post({ request: request() })).status).toBe(401);
    expect((await post({ request: new Request('http://localhost:8080/api/public/jobs/racing-dividends', { method: 'POST', body: JSON.stringify({ kind: 'refresh', extra: true }) }) })).status).toBe(400);
    expect(m.official).not.toHaveBeenCalled();
    expect(m.collect).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });
});