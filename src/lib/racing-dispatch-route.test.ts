import { afterEach, describe, expect, it, vi } from 'vitest';

const authenticate = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/cron-auth', () => ({ authenticateCronRequest: authenticate }));
vi.mock('@tanstack/react-router', () => ({ createFileRoute: () => (options: unknown) => options }));
import { Route } from '@/routes/api/public/jobs/racing-dispatch';

const handler = (Route as unknown as { server: { handlers: { POST: (input: { request: Request }) => Promise<Response> } } }).server.handlers.POST;
const request = () => new Request('http://localhost/api/public/jobs/racing-dispatch', { method: 'POST', body: JSON.stringify({ workflow: 'capy_integrity_audit.yml' }) });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('受認證派送停止條件', () => {
  it('未授權401不讀取或派送工作', async () => {
    authenticate.mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect((await handler({ request: request() })).status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('GitHub狀態讀取403時不派送', async () => {
    authenticate.mockResolvedValue(null); vi.stubEnv('GITHUB_TOKEN', 'mock-only');
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 403 })); vi.stubGlobal('fetch', fetcher);
    expect((await handler({ request: request() })).status).toBe(502);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('超過20分鐘仍在執行時不再派送', async () => {
    authenticate.mockResolvedValue(null); vi.stubEnv('GITHUB_TOKEN', 'mock-only');
    const fetcher = vi.fn().mockResolvedValue(Response.json({ workflow_runs: [{ created_at: new Date(Date.now() - 120 * 60000).toISOString(), status: 'in_progress', conclusion: null }] })); vi.stubGlobal('fetch', fetcher);
    const response = await handler({ request: request() });
    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('已認證且無近期工作時只派送白名單、不可冒稱交付', async () => {
    authenticate.mockResolvedValue(null); vi.stubEnv('GITHUB_TOKEN', 'mock-only');
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ workflow_runs: [] })).mockResolvedValueOnce(new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetcher);
    const response = await handler({ request: request() });
    expect(await response.json()).toMatchObject({ ok: true, executor: 'github-actions', deliveryVerified: false });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]?.[0]).toContain('/capy_integrity_audit.yml/dispatches');
  });
});