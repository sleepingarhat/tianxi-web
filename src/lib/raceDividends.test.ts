import { afterEach, expect, it, vi } from 'vitest';
import { fetchRaceDividends } from './raceDividends';
afterEach(() => vi.unstubAllGlobals());
it('空白派彩不可當成零元已結算', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('race_no,pool,combination,dividend_hkd\n2,孖T,"1,2,3/1,2,4",\n')));
  await expect(fetchRaceDividends('2026-10-19')).rejects.toThrow('未核實金額');
});
it('官方數字零派彩與仙位照實保留', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('race_no,pool,combination,dividend_hkd\n2,孖T,"1,2,3/1,2,4",100.25\n3,單T,"1,2,3",0\n')));
  expect((await fetchRaceDividends('2026-10-19')).map(r => r.dividend)).toEqual([100.25,0]);
});
it('騎師王詳情不是本頁投注彩池，不阻止孖T讀取', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('race_no,pool,combination,dividend_hkd\n2,孖T,"1,2,3/1,2,4",100.25\n11,騎師王 1,1 [潘頓],詳情\n')));
  expect(await fetchRaceDividends('2026-10-19')).toHaveLength(1);
});