import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), pro: vi.fn(), fetch: vi.fn(), validate: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => {
  const builder = { inputValidator: () => builder, handler: (handler: unknown) => handler };
  return builder;
} }));
vi.mock('@tanstack/react-start/server', () => ({ setResponseHeader: vi.fn() }));
vi.mock('./public-racing-evidence.server', () => ({ publicRacingQuery: (sql: string, params: unknown[]) => mocks.query(sql, params) }));
vi.mock('@/lib/public-racing-evidence.server', () => ({ publicRacingQuery: (sql: string, params: unknown[]) => mocks.query(sql, params) }));
vi.mock('./evidence-viewer.server', () => ({ evidenceViewerIsPro: () => mocks.pro() }));
vi.mock('./frozen-racing', () => ({ frozenColumns: ['date'], frozenEvidenceStatus: () => 'available', validateFrozenSnapshot: (...args: unknown[]) => mocks.validate(...args) }));
import { getLockedEvidence } from './racing-evidence.functions';

const read = getLockedEvidence as unknown as (input: { data: { raceId: string; horseId: string } }) => Promise<unknown>;
// Real public worker shape: anonymous edition is frozen; no test depends on real cloud env vars.
let body = () => publicBody as Record<string, unknown>;
const publicBody = { frozen: true, date: '2026-10-25', venue: 'ST', races: [{ raceNumber: 1, picks: [{ horseId: 'horse_K585' }] }] };

describe('賽前解釋實際讀取流程', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    // Fake values only: any read that reaches the real reader is routed back to mocks.query.
    vi.stubEnv('CLOUDFLARE_API_KEY', 'test-cf');
    vi.stubEnv('LOVABLE_API_KEY', 'test-lovable');
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'test-account');
    vi.stubEnv('TIANXI_ADMIN_TOKEN', 'test-only-private-token');
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.pro.mockResolvedValue(false);
    body = () => publicBody;
    mocks.fetch.mockImplementation(async (url: string, init?: { body?: string }) => {
      if (String(url).includes('/d1/')) {
        const { sql, params } = JSON.parse(init?.body ?? '{}');
        return { ok: true, json: async () => ({ success: true, result: [{ success: true, results: await mocks.query(sql, params) }] }) };
      }
      return { ok: true, json: async () => body() };
    });
    mocks.validate.mockResolvedValue({ venue: 'ST', rows: [1, 2].map(race_number => ({ race_number, horse_id: 'horse_K585' })) });
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('COUNT(DISTINCT venue)')) return [{ count: 1 }];
      if (sql.includes('FROM race_results')) return [];
      if (sql.includes('prediction_original_snapshots')) return [{ snapshot_json: '{}', sha256: 'test', ok: 1 }];
      if (sql.includes('horse_pedigree')) return [{ horseElo: 1500, rank: 1, generatedAt: '2026-10-25T02:00:00Z' }];
      return [];
    });
  });
  const workerCalls = () => mocks.fetch.mock.calls.filter(([url]) => !String(url).includes('/d1/'));
  const input = (n: number) => ({ data: { raceId: `race_2026-10-25_ST_${n}`, horseId: 'horse_K585' } });

  it('無賽後races行仍可讀核實第1場原解釋，公開讀取不帶任何憑證', async () => {
    expect(await read(input(1))).toMatchObject({ horseElo: 1500, provenance: 'public-frozen-picks' });
    const query = mocks.query.mock.calls.find(([sql]) => sql.includes('horse_pedigree'));
    expect(query?.[0]).not.toContain('JOIN races');
    expect(query?.[1]).toEqual(['2026-10-25', 1, 'horse_K585']);
    const worker = workerCalls();
    expect(worker).toHaveLength(1);
    expect(worker[0]?.[1]?.headers).toBeUndefined();
  });
  it('免費用戶第2場不查原解釋', async () => {
    expect(await read(input(2))).toBeNull();
    expect(workerCalls()).toHaveLength(0);
    expect(mocks.validate).not.toHaveBeenCalled();
  });
  it('免費用戶公開版未凍結即拒絕', async () => {
    body = () => ({ ...publicBody, frozen: false });
    expect(await read(input(1))).toBeNull();
    expect(mocks.validate).not.toHaveBeenCalled();
  });
  it('Pro第1場及第2場只靠原副本核實，不呼叫Worker', async () => {
    mocks.pro.mockResolvedValue(true);
    expect(await read(input(1))).toMatchObject({ horseElo: 1500, provenance: 'public-frozen-picks' });
    expect(await read(input(2))).toMatchObject({ horseElo: 1500, provenance: 'public-frozen-picks' });
    expect(workerCalls()).toHaveLength(0);
    expect(mocks.validate).toHaveBeenCalledTimes(2);
  });
  it('Pro原副本鎖點未過或核實失敗即拒絕', async () => {
    mocks.pro.mockResolvedValue(true);
    mocks.validate.mockRejectedValue(new Error('凍結身份或鎖點未能核實'));
    await expect(read(input(2))).rejects.toThrow('凍結身份或鎖點未能核實');
    expect(mocks.query.mock.calls.some(([sql]) => sql.includes('horse_pedigree'))).toBe(false);
  });
  it('Pro原副本馬場或馬匹不符即拒絕', async () => {
    mocks.pro.mockResolvedValue(true);
    mocks.validate.mockResolvedValue({ venue: 'HV', rows: [{ race_number: 2, horse_id: 'horse_K585' }] });
    expect(await read(input(2))).toBeNull();
    mocks.validate.mockResolvedValue({ venue: 'ST', rows: [{ race_number: 2, horse_id: 'horse_X1' }] });
    expect(await read(input(2))).toBeNull();
  });
  it('原副本不符拒絕，不回退賽後重算紀錄', async () => {
    mocks.validate.mockRejectedValue(new Error('原始副本指紋不一致'));
    await expect(read(input(1))).rejects.toThrow('原始副本指紋不一致');
    expect(mocks.query.mock.calls.some(([sql]) => sql.includes('horse_pedigree'))).toBe(false);
  });
});
