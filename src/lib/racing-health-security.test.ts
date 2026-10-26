import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ read: vi.fn(), role: vi.fn(), header: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder,
    handler: (fn: (args: unknown) => unknown) => fn };
  return builder;
} }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
vi.mock('./tier.server', () => ({ requireTier: () => ({}) }));
vi.mock('./racing-health.server', () => ({ readRacingHealth: mocks.read }));
vi.mock('@tanstack/react-start/server', () => ({ setResponseHeader: mocks.header }));
import { getAdminRacingHealth, getRacingHealth } from './racingOps.functions';
import { publicRacingHealth } from './racing-health-projection';

const health = () => ({ checkedAt: '2026-10-26T12:00:00Z', lastDividend: null, workflows: [],
  telegram: { ok: true, chatLinked: true, detail: 'private connector diagnostic',
    failing: [{ key: 'private-job-key', fail: 'private alert body', sentAt: '2026-10-26T11:00:00Z' }] },
  jobTicks: [{ job: 'racing-dividends', label: '官方派彩自動核對', at: '2026-10-26T12:00:00Z', status: 'ok' as const, stale: false },
    { job: 'private-job', label: 'private label', at: null, status: 'fail' as const, stale: true }],
});
beforeEach(() => { vi.resetAllMocks(); mocks.read.mockResolvedValue(health()); });
afterEach(() => vi.restoreAllMocks());
const adminCall = async () => {
  const chain = { select: () => chain, eq: () => chain, maybeSingle: mocks.role };
  const fn = getAdminRacingHealth as unknown as (a: unknown) => Promise<unknown>;
  return fn({ context: { userId: 'test-user', supabase: { from: () => chain } } });
};
describe('public health security boundary', () => {
  it('public RPC strips internal diagnostics, destinations and future fields', async () => {
    mocks.read.mockResolvedValue({ ...health(), secretFutureField: 'private future value' });
    const out = await (getRacingHealth as unknown as () => Promise<unknown>)();
    expect(out).toEqual(publicRacingHealth(health()));
    const json = JSON.stringify(out);
    for (const value of ['private', 'chatLinked', 'detail', 'sentAt', 'failing', 'secretFutureField']) expect(json).not.toContain(value);
    expect(mocks.header).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
  });
  it('reports broken destination as unhealthy without revealing it', () => {
    const d = health(); d.telegram.chatLinked = false;
    expect(publicRacingHealth(d).telegram).toEqual({ ok: false, openAlerts: 1 });
  });
  it.each([{ data: null, error: null }, { data: { role: 'admin' }, error: { message: 'unavailable' } }])('denies missing or unreadable admin role before private reads', async result => {
    mocks.role.mockResolvedValue(result);
    await expect(adminCall()).rejects.toMatchObject({ status: 403 });
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it('verified admin retains full diagnostic response', async () => {
    mocks.role.mockResolvedValue({ data: { role: 'admin' }, error: null });
    expect(await adminCall()).toEqual(health());
    expect(mocks.header).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
  });
});