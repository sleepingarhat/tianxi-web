import { sameMeeting } from "./audit-safety";

/** 單場頁引擎首選來源：只用已核實凍結／全日預測（同日同馬場先採用），絕不回退到舊後端即時預測。 */
export function racePicksFromDay(
  dayPicks: { date?: string | null | undefined; venue?: string | null | undefined; races?: { raceNumber?: number | string | null | undefined; picks?: unknown[] | undefined }[] | undefined } | null | undefined,
  raceDate: string,
  venueCode: string,
  raceNumber: number,
): unknown[] {
  if (!sameMeeting(raceDate, venueCode, dayPicks)) return [];
  const race = (dayPicks?.races || []).find((r) => Number(r.raceNumber) === raceNumber);
  return race?.picks || [];
}
