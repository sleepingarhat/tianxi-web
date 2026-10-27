import { parseRacecardDisplay } from "./racecard-display";

type Cached = { at: number; distance: number | null; going: string | null; surface: string | null; matched: boolean };

const raceCache = new Map<string, Cached>();
const goingCache = new Map<string, { at: number; track: string | null; goings: Record<number, string> }>();
const OK_MS = 30 * 60_000;
const EMPTY_MS = 5 * 60_000;
const MISS_MS = 2 * 60_000;

function fresh(row: Cached | undefined, now: number): boolean {
  if (!row) return false;
  const ttl = !row.matched ? MISS_MS : row.distance != null ? OK_MS : EMPTY_MS;
  return now - row.at < ttl;
}

async function readRacecard(date: string, venue: "ST" | "HV", raceNumber: number, now: number): Promise<Cached> {
  const key = `${date}:${venue}:${raceNumber}`;
  const hit = raceCache.get(key);
  if (fresh(hit, now)) return hit!;
  const [y, m, d] = date.split("-");
  const url = `https://racing.hkjc.com/racing/information/Chinese/Racing/Racecard.aspx?RaceDate=${y}/${m}/${d}&Racecourse=${venue}&RaceNo=${raceNumber}`;
  let parsed = { matched: false, distance: null as number | null, going: null as string | null, surface: null as string | null };
  try {
    const response = await fetch(url, {
      headers: { Accept: "text/html" },
      signal: AbortSignal.timeout(8_000),
    });
    if (response.ok) {
      const html = await response.text();
      if (html.length <= 2_000_000) {
        const display = parseRacecardDisplay(html, { date, venue, raceNumber });
        parsed = { matched: display.matched, distance: display.distance, going: display.going, surface: display.surface };
      }
    }
  } catch {
    parsed = { matched: false, distance: null, going: null, surface: null };
  }
  const row = { at: now, ...parsed };
  raceCache.set(key, row);
  return row;
}

export async function loadRaceDayCardDisplay(input: {
  date: string;
  venue: "ST" | "HV";
  raceNumbers: number[];
  needGoing: boolean;
}): Promise<{
  meetingTrack: string | null;
  meetingGoing: string | null;
  races: { raceNumber: number; distance: number | null; going: string | null; surface: string | null }[];
}> {
  const now = Date.now();
  let track: string | null = null;
  let goings: Record<number, string> = {};
  if (input.needGoing || input.raceNumbers.length) {
    const key = `${input.date}:${input.venue}`;
    const cached = goingCache.get(key);
    if (cached && now - cached.at < OK_MS) {
      track = cached.track;
      goings = cached.goings;
    } else {
      const { fetchOfficialMeetingCard } = await import("./features.server");
      const card = await fetchOfficialMeetingCard(input.date, input.venue);
      track = card.track;
      goings = card.goings;
      goingCache.set(key, { at: now, track, goings });
    }
  }
  const values = Object.values(goings);
  const meetingGoing = values.length && values.every((g) => g === values[0]) ? values[0]! : null;
  const races = await Promise.all(
    input.raceNumbers.map(async (raceNumber) => {
      const row = await readRacecard(input.date, input.venue, raceNumber, now);
      return {
        raceNumber,
        distance: row.distance,
        going: goings[raceNumber] ?? row.going,
        surface: row.surface,
      };
    }),
  );
  return { meetingTrack: track, meetingGoing, races };
}

/** 測試用：清顯示快取，避免場次之間互相污染。 */
export function clearRaceDayCardCache(): void {
  raceCache.clear();
  goingCache.clear();
}
