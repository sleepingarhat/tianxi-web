import { createServerFn } from "@tanstack/react-start";
import { normalizeRaceHeaders } from "./race-header";

// 公開官方排位表場次頭；只讀 entries_upcoming 公開欄位，不含任何預測。
export const getRaceHeaders = createServerFn({ method: "GET" })
  .inputValidator((input: { date?: string; venue?: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input?.date ?? ""))) throw new Error("日期格式無效");
    if (input?.venue !== "ST" && input?.venue !== "HV") throw new Error("馬場無效");
    return { date: String(input.date), venue: input.venue === "HV" ? "HV" : "ST" };
  })
  .handler(async ({ data }) => {
    const { publicRacingQuery } = await import("./public-racing-evidence.server");
    try {
      const rows = await publicRacingQuery<Record<string, unknown>>(
        "SELECT race_number raceNumber, MAX(race_name) raceName, MAX(post_time) postTime, MAX(race_class) raceClass, MAX(rating_range) ratingRange, MAX(prize) prize, MAX(track) track, MAX(course) course, MAX(going) going, MAX(distance) distance FROM entries_upcoming WHERE race_date=? AND venue=? AND race_number BETWEEN 1 AND 14 GROUP BY race_number",
        [data.date, data.venue],
      );
      return { races: normalizeRaceHeaders(rows), error: null as string | null };
    } catch (e) {
      console.error("race headers read failed", e);
      return { races: [], error: "官方場次資料暫時未能讀取" };
    }
  });
