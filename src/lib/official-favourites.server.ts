import { readCloudOfficialResults } from './hkjc-results-collector.server';
import { deriveOfficialFavourites, type OfficialFavourites } from './official-favourites';

/**
 * Official favourite order for one meeting, built ONLY from archived,
 * identity-verified HKJC official result snapshots (raw HTML + SHA-256 kept).
 * No live fetch, no guesswork: a race whose archived odds cannot certify the
 * order is returned as unverified and stays pending in settlement.
 */
export async function readOfficialFavourites(date: string, venue: string): Promise<OfficialFavourites[]> {
  const races = await readCloudOfficialResults(date, venue);
  return races.map((r) =>
    deriveOfficialFavourites(
      r.raceNumber,
      r.results.map((x) => ({ raceNumber: r.raceNumber, horseNumber: x.horseNumber, winOdds: x.winOdds, finishingPosition: x.finishingPosition })),
      { sourceUrl: r.sourceUrl, sha256: r.sha256, fetchedAt: r.fetchedAt },
    ),
  );
}
