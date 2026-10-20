import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('./official-favourites.functions', () => ({ getOfficialFavourites: vi.fn() }));
vi.mock('./hkjc-changes.functions', () => ({ getHkjcChanges: vi.fn() }));
import { calcPools, exoticPoolOptions } from './racingPoolAccounting';
import { getHkjcChanges } from './hkjc-changes.functions';

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe('跨場共用明細及無存證', () => {
  it('無存證不讀更改或派彩，不冒充讀取失敗', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ reason: 'no-archive' }, { status: 503 }));
    vi.stubGlobal('fetch', fetcher);
    const options = exoticPoolOptions('2026-10-03');
    const run = options.queryFn;
    if (typeof run !== 'function') throw new Error('missing query');
    const result = await run({} as Parameters<typeof run>[0]);
    expect(result.noArchive).toBe(true);
    expect(result.pools).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(getHkjcChanges).not.toHaveBeenCalled();
  });
  it('孖T兩場命中整口9注90元，派彩只計一次', () => {
    const leg = (race: number) => ({ race, bankers: [1, 2], legs: [3, 4, 5], fifthFromLive: false as const });
    const pools = calcPools([{ race_no: 2, pool: '孖T', combo: '1,2,3/1,2,4', dividend: 1000, unit: 10 }], { 1: leg(1), 2: leg(2) });
    expect(pools[0]).toMatchObject({ units: 9, cost: 90, payout: 1000, mainHit: true, mainDividend: 1000 });
    expect(pools[0]?.detail.map(d => d.hit)).toEqual([true, true]);
    expect(pools[0]?.detail[1]?.winningCombination).toBe('1,2,4');
  });
});