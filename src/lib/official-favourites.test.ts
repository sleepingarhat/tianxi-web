import { describe, expect, it } from 'vitest';
import { deriveOfficialFavourites, favouriteOrderForSettlement, type OddsRow } from './official-favourites';

const SRC = { sourceUrl: 'https://racing.hkjc.com/…localresults?RaceDate=2026%2F10%2F19&Racecourse=ST&RaceNo=8', sha256: 'c7bf6e45d1ccb17fe7eeb79d17d74f9a213d76a5d527c7c8f38d612ef8e125a9', fetchedAt: '2026-10-19T13:20:08.766Z' };

/** Official archived win odds for 2026-10-19 ST R8 (#4 did not start: no odds, no placing). */
const row = (horseNumber: number, winOdds: number | null, finishingPosition: number | null): OddsRow => ({ raceNumber: 8, horseNumber, winOdds, finishingPosition });
const R8: OddsRow[] = [
  row(1, 33, 11), row(2, 2.8, 3), row(3, 14, 6), row(4, null, null), row(5, 21, 5), row(6, 29, 2),
  row(7, 8.8, 1), row(8, 12, 9), row(9, 57, 7), row(10, 2.5, 4), row(11, 31, 10), row(12, 31, 8),
];

describe('官方熱門次序（只用已存證官方賽果賠率）', () => {
  it('按獨贏賠率由低至高排，未起步馬匹唔會排尾', () => {
    const r = deriveOfficialFavourites(8, R8, SRC);
    expect(r.status).toBe('ambiguous');
    expect(r.favourites).toEqual([10, 2, 7, 8, 3, 5, 6, 11]);
    expect(r.favourites).not.toContain(4);
    expect(r.reason).toContain('第 9 位');
    // 首 8 位已經認證，足夠替補一注孖T／三T（最多換 5 隻），所以可以用嚟結算
    expect(favouriteOrderForSettlement(r)).toEqual([10, 2, 7, 8, 3, 5, 6, 11]);
  });
  it('賠率冇同數時次序可全份認證', () => {
    const rows = R8.filter((x) => x.horseNumber !== 12).map((x) => (x.horseNumber === 11 ? { ...x, winOdds: 30 } : x));
    const r = deriveOfficialFavourites(8, rows, SRC);
    expect(r.status).toBe('certified');
    expect(r.favourites[0]).toBe(10);
    expect(r.favourites).toHaveLength(10);
    expect(favouriteOrderForSettlement(r)).toEqual(r.favourites);
  });
  it('參賽馬缺賠率即未能核實，唔會當佢無份', () => {
    const rows = R8.map((x) => (x.horseNumber === 2 ? { ...x, winOdds: null, finishingPosition: 3 } : x));
    const r = deriveOfficialFavourites(8, rows, SRC);
    expect(r.status).toBe('incomplete');
    expect(r.favourites).toEqual([]);
    expect(favouriteOrderForSettlement(r)).toBeNull();
  });
  it('頭馬賠率相同即全份不可用，唔猜邊匹係熱門', () => {
    const rows = R8.map((x) => (x.horseNumber === 10 ? { ...x, winOdds: 2.8 } : x));
    const r = deriveOfficialFavourites(8, rows, SRC);
    expect(r.status).toBe('ambiguous');
    expect(r.favourites).toHaveLength(1);
    expect(favouriteOrderForSettlement(r)).toBeNull();
  });
  it('存證來源連同次序一併交回，方便對帳', () => {
    const rows = R8.filter((x) => x.horseNumber !== 12);
    const r = deriveOfficialFavourites(8, rows, SRC);
    expect(r.source).toEqual(SRC);
    expect(r.source.sha256).toHaveLength(64);
  });
});
