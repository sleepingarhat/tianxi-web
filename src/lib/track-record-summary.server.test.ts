import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ read: vi.fn(), publish: vi.fn(async value => value), coverage: vi.fn(), versions: vi.fn() }));
vi.mock('./record-summary-snapshot.server', () => ({ readPublishedSummary: mocks.read, publishSummary: mocks.publish }));
vi.mock('./coverage-audit.server', () => ({ readCoverageAudit: mocks.coverage }));
vi.mock('./version-history.server', () => ({ readVersionHistory: mocks.versions }));
describe('summary snapshot delivery', () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    mocks.read.mockResolvedValue({ generatedAt: '2026-10-21T00:00:00Z' });
    mocks.coverage.mockResolvedValue({ rows: [], checkedAt: '2026-10-21T00:00:00Z' });
    mocks.versions.mockResolvedValue({ versions: [], truncated: false });
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => ({ windowDays: Number(new URL(url).searchParams.get('days')), racesEvaluated: 118, meetingsEvaluated: 12, top4AvgIntersect: 1.99, generatedAt: '2026-10-21T00:00:00Z', perMeeting: [] }) })));
  });
  it('cold visitors read one complete snapshot without recomputing market, versions or rollups', async () => {
    const { readTrackRecordSummary } = await import('./track-record-summary.server');
    await Promise.all([readTrackRecordSummary(), readTrackRecordSummary()]);
    expect(mocks.read).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.coverage).not.toHaveBeenCalled();
    expect(mocks.versions).not.toHaveBeenCalled();
  });
  it('authenticated refresh bypasses snapshot TTL and publishes all four windows', async () => {
    const { readTrackRecordSummary } = await import('./track-record-summary.server');
    await readTrackRecordSummary();
    const value = await readTrackRecordSummary(true);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(Object.keys(value.rollups)).toEqual(['30', '60', '90', '180']);
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(mocks.coverage).toHaveBeenCalledWith(180, true);
    expect(value.summary['last90']).toMatchObject({ races: 118, avgHit: 1.99 });
    expect(await readTrackRecordSummary()).toEqual(value);
  });
  it('a failed market refresh never publishes a partial snapshot or erases the previous one', async () => {
    const { readTrackRecordSummary } = await import('./track-record-summary.server');
    const previous = await readTrackRecordSummary();
    mocks.coverage.mockRejectedValueOnce(new Error('market failed'));
    await expect(readTrackRecordSummary(true)).rejects.toThrow('market failed');
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(await readTrackRecordSummary()).toEqual(previous);
  });
  it('a missing published snapshot fails explicitly without expensive visitor-triggered work', async () => {
    mocks.read.mockRejectedValueOnce(new Error('missing snapshot'));
    const { readTrackRecordSummary } = await import('./track-record-summary.server');
    await expect(readTrackRecordSummary()).rejects.toThrow('missing snapshot');
    expect(fetch).not.toHaveBeenCalled();
  });
});