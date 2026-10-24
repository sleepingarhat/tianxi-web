import type { DayPicks, RaceRow } from "./racing-shapes";
import type { Tier } from "./tiers";

/**
 * 伺服器端全日預測投影（PRO_ENFORCEMENT=on 先生效）。
 * 同前端現時「最多」顯示嘅內容一致，所以 UX 不變：
 *   - Pro／管理員：全部場次、全部揀選
 *   - 其他人：第一場同已完賽場次全部揀選；其餘場次只保留首選一匹（race.tsx／cards.tsx 本身只顯示首選）
 * 純函數，唔會改動原本（可能被快取共用）嘅物件。
 */
export function projectDayPicksForViewer(day: DayPicks, tier: Tier): DayPicks {
  if (tier === "pro" || !Array.isArray(day?.races)) return day;
  return {
    ...day,
    races: day.races.map((race: RaceRow) => {
      const open =
        Number(race.raceNumber) === 1 || race.settled === true || race.hasResult === true;
      if (open || !Array.isArray(race.picks)) return race;
      return { ...race, picks: race.picks.slice(0, 1) };
    }),
  };
}

export function proEnforcementEnabled(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  return (env["PRO_ENFORCEMENT"] ?? "").trim().toLowerCase() === "on";
}
