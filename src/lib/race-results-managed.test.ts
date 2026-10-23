import { afterEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => vi.fn());
vi.mock('@tanstack/react-router', () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock('@/integrations/supabase/cron-auth', () => ({ authenticateCronRequest: auth }));
import { Route as managed } from '@/routes/api/public/jobs/race-results-dispatch';
import { Route as legacy } from '@/routes/api/public/hooks/race-results-dispatch';
type PostRoute = { server: { handlers: { POST: (args: { request: Request }) => Promise<Response> } } };
const post = (route: unknown) => (route as PostRoute).server.handlers.POST({ request: new Request('https://tianxi.racing/api/public/jobs/race-results-dispatch', { method: 'POST', body: JSON.stringify({ force: 'y', date: '2000-01-01', workflow: 'arbitrary' }) }) });
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('賽果派送平台驗證', () => {
  it('未授權不得派送', async () => {
    auth.mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect((await post(managed)).status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('只能派送原固定工作且不強制重收，不冒稱完成', async () => {
    auth.mockResolvedValue(null); vi.stubEnv('GITHUB_TOKEN', 'mock-only');
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetcher);
    const response = await post(managed);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, deliveryVerified: false });
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.github.com/repos/sleepingarhat/tianxi-racing/actions/workflows/capy_race_daily.yml/dispatches');
    expect(JSON.parse(fetcher.mock.calls[0]?.[1].body)).toEqual({ ref: 'main', inputs: { date: '', force: 'n' } });
  });
  it('GitHub拒絕不可當成派送成功', async () => {
    auth.mockResolvedValue(null); vi.stubEnv('GITHUB_TOKEN', 'mock-only');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    expect((await post(managed)).status).toBe(502);
  });
  it('原入口保留x-cron-secret驗證，平台驗證不能繞過', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect((await post(legacy)).status).toBe(401);
    expect(auth).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });
});