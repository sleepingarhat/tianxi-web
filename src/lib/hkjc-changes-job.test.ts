import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), capture: vi.fn(), read: vi.fn(), recompute: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock('@/integrations/supabase/cron-auth', () => ({ authenticateCronRequest: mocks.auth }));
vi.mock('@/lib/hkjc-changes.server', () => ({ captureHkjcChanges: mocks.capture, readLatestHkjcChanges: mocks.read, recomputeIfStaleBeforeLock: mocks.recompute }));
import { Route } from '@/routes/api/public/jobs/hkjc-changes';
const handler = (Route as unknown as { server: { handlers: { POST: (input: { request: Request }) => Promise<Response> } } }).server.handlers.POST;
afterEach(() => vi.clearAllMocks());
describe('更改工作不能將重算失敗當HTTP成功', () => {
  it('重算例外回502而不是200', async () => {
    mocks.auth.mockResolvedValue(null);
    mocks.capture.mockResolvedValue({ ok: true, date: '2026-10-21', venue: 'HV', sha256: 'fixture' });
    mocks.read.mockResolvedValue({ changes: [] });
    mocks.recompute.mockRejectedValue(new Error('lease-failed'));
    const response = await handler({ request: new Request('http://localhost/api/public/jobs/hkjc-changes', { method: 'POST' }) });
    expect(response.status).toBe(502);
    expect((await response.json()).precheck.action).toBe('error');
  });
});