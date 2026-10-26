import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@tanstack/react-router', () => ({ createFileRoute: () => (o: unknown) => o }));
import { Route } from '@/routes/api/public/draw-tune';

afterEach(() => vi.unstubAllGlobals());
describe('retired public research proxy', () => {
  it.each(['', '?from=2026-10-01&to=2026-10-25&scales=1,2'])('returns 410 without upstream work %s', async query => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const route = Route as unknown as { server: { handlers: { GET: (a: { request: Request }) => Promise<Response> } } };
    const res = await route.server.handlers.GET({ request: new Request(`https://tianxi.racing/api/public/draw-tune${query}`) });
    expect(res.status).toBe(410);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(fetcher).not.toHaveBeenCalled();
  });
});