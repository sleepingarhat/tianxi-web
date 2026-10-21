import { beforeEach, describe, expect, it, vi } from 'vitest';
const cache = vi.hoisted(() => vi.fn(async (_key: string, _ttl: number, compute: () => Promise<unknown>) => compute()));
vi.mock('./computed-cache.server', () => ({ cached: cache }));
vi.mock('./coverage-audit.server', () => ({ readCoverageAudit: async () => ({ rows: [], checkedAt: '2026-10-21T00:00:00Z' }) }));
vi.mock('./version-history.server', () => ({ readVersionHistory: async () => ({ versions: [], truncated: false }) }));
describe('summary refresh delivery', () => {
  beforeEach(() => { vi.resetModules(); cache.mockClear(); vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => ({ windowDays: Number(new URL(url).searchParams.get('days')), racesEvaluated: 118, meetingsEvaluated: 12, top4AvgIntersect: 1.99, generatedAt: '2026-10-21T00:00:00Z', perMeeting: [] }) }))); });
  it('authenticated refresh bypasses the one-hour TTL and reads all four windows', async () => {
    const { readTrackRecordSummary } = await import('./track-record-summary.server');
    await readTrackRecordSummary(true);
    expect(cache).toHaveBeenCalledWith('track-record-summary:v2', 0, expect.any(Function));
    expect(fetch).toHaveBeenCalledTimes(4);
    await readTrackRecordSummary();
    expect(fetch).toHaveBeenCalledTimes(4);
    await readTrackRecordSummary(true);
    expect(fetch).toHaveBeenCalledTimes(8);
    vi.unstubAllGlobals();
  });
});