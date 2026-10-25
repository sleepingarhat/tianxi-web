import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), pro: vi.fn(), fetch: vi.fn(), validate: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => {
  const builder = { inputValidator: () => builder, handler: (handler: unknown) => handler };
  return builder;
} }));
vi.mock('@tanstack/react-start/server', () => ({ setResponseHeader: vi.fn() }));
vi.mock('./public-racing-evidence.server', () => ({ publicRacingQuery: mocks.query }));
vi.mock('./evidence-viewer.server', () => ({ evidenceViewerIsPro: mocks.pro }));
vi.mock('./frozen-racing', () => ({ frozenColumns: ['date'], frozenEvidenceStatus: () => 'available', validateFrozenSnapshot: mocks.validate }));
import { getLockedEvidence } from './racing-evidence.functions';

const read = getLockedEvidence as unknown as (input: { data: { raceId: string; horseId: string } }) => Promise<unknown>;
describe('賽前解釋實際讀取流程', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('TIANXI_ADMIN_TOKEN', 'test-only-private-token');
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.pro.mockResolvedValue(false);
    mocks.fetch.mockImplementation(async (url: string, init: { body?: string }) => {
      if (url.includes('/d1/')) {
        const { sql, params } = JSON.parse(init.body ?? '{}');
        return { ok: true, json: async () => ({ success: true, result: [{ success: true, results: await mocks.query(sql, params) }] }) };
      }
      return { ok: true, json: async () => ({ frozen: true, date: '2026-10-25', venue: 'ST', races: [1,2].map(raceNumber => ({ raceNumber, picks: [{ horseId: 'horse_K585' }] })) }) };
    });
    mocks.validate.mockResolvedValue({ venue: 'ST', rows: [1,2].map(race_number => ({ race_number, horse_id: 'horse_K585' })) });
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('COUNT(DISTINCT venue)')) return [{ count: 1 }];
      if (sql.includes('FROM race_results')) return [];
      if (sql.includes('prediction_original_snapshots')) return [{ snapshot_json: '{}', sha256: 'test', ok: 1 }];
      if (sql.includes('horse_pedigree')) return [{ horseElo: 1500, rank: 1, generatedAt: '2026-10-25T02:00:00Z' }];
      return [];
    });
  });
  const input = (n: number) => ({ data: { raceId: `race_2026-10-25_ST_${n}`, horseId: 'horse_K585' } });
  it('無賽後races行仍可讀核實第1場原解釋', async () => {
    expect(await read(input(1))).toMatchObject({ horseElo: 1500, provenance: 'public-frozen-picks' });
    const query = mocks.query.mock.calls.find(([sql]) => sql.includes('horse_pedigree'));
    expect(query?.[0]).not.toContain('JOIN races');
    expect(query?.[1]).toEqual(['2026-10-25',1,'horse_K585']);
    expect(mocks.fetch.mock.calls[0]?.[1].headers).toEqual({});
  });
  it('免費用戶第2場不查原解釋或用私人憑證', async () => {
    expect(await read(input(2))).toBeNull();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('核實Pro第2場可讀解釋，私人憑證只附上伺服器請求', async () => {
    mocks.pro.mockResolvedValue(true);
    expect(await read(input(2))).toMatchObject({ horseElo: 1500 });
    expect(mocks.fetch.mock.calls[0]?.[1].headers).toEqual({ authorization: 'Bearer test-only-private-token' });
  });
  it('原副本不符拒絕，不回退賽後重算紀錄', async () => {
    mocks.validate.mockRejectedValue(new Error('原始副本指紋不一致'));
    await expect(read(input(1))).rejects.toThrow('原始副本指紋不一致');
    expect(mocks.query.mock.calls.some(([sql]) => sql.includes('horse_pedigree'))).toBe(false);
  });
});