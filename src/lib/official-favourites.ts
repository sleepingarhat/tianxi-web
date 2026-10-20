/**
 * Official favourite ordering, derived ONLY from archived HKJC official result
 * rows (each runner's official win odds). Nothing is guessed or back-filled:
 * if the archived evidence cannot certify the order, the race stays unverified
 * and any affected Double/Triple Trio ticket remains pending.
 *
 * Rule basis: HKJC Rule 3.10(b)(iii) — a withdrawn selection on an original
 * Double Trio / Triple Trio ticket is replaced by the official favourite, then
 * 2nd, 3rd favourite, provided each is not already selected in that leg.
 */
export type FavouriteSource = { sourceUrl: string; sha256: string; fetchedAt: string };

export type OfficialFavourites = {
  raceNumber: number;
  /** certified = safe to use for substitution; anything else must stay pending. */
  status: 'certified' | 'incomplete' | 'ambiguous' | 'unverified';
  /** Certified favourite order only (stops before the first uncertifiable rank). */
  favourites: number[];
  reason: string | null;
  source: FavouriteSource;
};

/** One archived official result row. `winOdds` is the official win-pool odds. */
export type OddsRow = {
  raceNumber: number;
  horseNumber: number;
  winOdds: number | null;
  finishingPosition: number | null;
};

const MIN_RUNNERS = 4;

/**
 * Rank runners by ascending official win odds. A runner with no odds and no
 * finishing position is a non-starter (withdrawal) and is excluded — it is not
 * ranked last. A starter with missing odds makes the whole ordering
 * uncertifiable, because the true favourite could be that runner.
 * Equal odds cannot be separated by this evidence, so certification stops at
 * the first tie instead of guessing which horse was the official favourite.
 */
export function deriveOfficialFavourites(
  raceNumber: number,
  rows: readonly OddsRow[],
  source: FavouriteSource,
): OfficialFavourites {
  const base = { raceNumber, source };
  if (rows.length < MIN_RUNNERS) {
    return { ...base, status: 'unverified', favourites: [], reason: '冇足夠官方排位資料' };
  }
  const rankable: { horseNumber: number; odds: number }[] = [];
  for (const r of rows) {
    if (!Number.isInteger(r.horseNumber) || r.horseNumber < 1) {
      return { ...base, status: 'incomplete', favourites: [], reason: '馬號資料不完整' };
    }
    const odds = r.winOdds;
    if (odds == null || !Number.isFinite(odds) || odds <= 0) {
      // No odds and no placing = did not start; excluded from favourite order.
      if (r.finishingPosition == null) continue;
      return { ...base, status: 'incomplete', favourites: [], reason: '有參賽馬匹欠缺官方獨贏賠率，熱門次序未能核實' };
    }
    rankable.push({ horseNumber: r.horseNumber, odds });
  }
  if (rankable.length < MIN_RUNNERS) {
    return { ...base, status: 'incomplete', favourites: [], reason: '有賠率嘅參賽馬匹不足', };
  }
  rankable.sort((a, b) => a.odds - b.odds || a.horseNumber - b.horseNumber);
  const favourites: number[] = [];
  let prev: { horseNumber: number; odds: number } | null = null;
  for (let i = 0; i < rankable.length; i++) {
    const cur = rankable[i];
    if (!cur) continue;
    if (prev && cur.odds === prev.odds) {
      return {
        ...base,
        status: 'ambiguous',
        favourites,
        reason: `第 ${i + 1} 位起有馬匹獨贏賠率相同，官方熱門次序未能核實`,
      };
    }
    favourites.push(cur.horseNumber);
    prev = cur;
  }
  return { ...base, status: 'certified', favourites, reason: null };
}

/**
 * Favourite evidence usable by Rule 3.10(b)(iii) settlement. A leg replaces at
 * most its own selections (2 bankers + 3 legs = 5), so a certified prefix of
 * five favourites is enough to substitute any withdrawn selection without
 * guessing. Anything shorter — e.g. an equal-odds tie at rank 2 — stays
 * pending instead of picking a favourite the archived odds cannot separate.
 */
export const MIN_SUBSTITUTES = 5;

export function favouriteOrderForSettlement(f: OfficialFavourites | null | undefined): number[] | null {
  if (!f || f.favourites.length < MIN_SUBSTITUTES) return null;
  return [...f.favourites];
}
