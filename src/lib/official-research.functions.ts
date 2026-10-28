import { createServerFn } from "@tanstack/react-start";
import { officialMeetingDate, officialHorseBrand, projectOfficialRows, HORSE_OFFICIAL_FIELDS, POOL_OFFICIAL_FIELDS, DRAW_OFFICIAL_FIELDS, type OfficialSection } from "./official-research";

export const getHorseOfficialResearch = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => ({ brand: officialHorseBrand(input.id) }))
  .handler(async ({ data }) => {
    const { publicRacingQuery } = await import("./public-racing-evidence.server");
    const read = async (table: string, fields: readonly string[], suffix: string): Promise<OfficialSection> => {
      try {
        const rows = await publicRacingQuery<Record<string, unknown>>(`SELECT ${fields.join(", ")} FROM ${table} WHERE brand_no=? ${suffix}`, [data.brand]);
        return { rows: projectOfficialRows(rows, fields), available: true };
      } catch (error) { console.error("official horse reference unavailable", error); return { rows: [], available: false }; }
    };
    const [rating, performance, movement, overoar] = await Promise.all([
      read("official_rating_weight", HORSE_OFFICIAL_FIELDS.rating, "ORDER BY race_date DESC LIMIT 30"),
      read("official_performance", HORSE_OFFICIAL_FIELDS.performance, "AND section='distance' ORDER BY label_a, label_b LIMIT 60"),
      read("official_movement", HORSE_OFFICIAL_FIELDS.movement, "ORDER BY arrive_date DESC LIMIT 20"),
      read("official_overoar", HORSE_OFFICIAL_FIELDS.overoar, "LIMIT 1"),
    ]);
    return { rating, performance, movement, overoar };
  });

export const getMeetingOfficialResearch = createServerFn({ method: "GET" })
  .inputValidator((input: { date: string; venue: string }) => {
    if (!["ST", "HV"].includes(input.venue)) throw new Error("馬場無效");
    return { date: officialMeetingDate(input.date), venue: input.venue };
  })
  .handler(async ({ data }) => {
    const { publicRacingQuery } = await import("./public-racing-evidence.server");
    const read = async (sql: string, params: unknown[], fields: readonly string[]): Promise<OfficialSection> => {
      try { return { rows: projectOfficialRows(await publicRacingQuery<Record<string, unknown>>(sql, params), fields), available: true }; }
      catch (error) { console.error("official meeting reference unavailable", error); return { rows: [], available: false }; }
    };
    const [pools, draws] = await Promise.all([
      read(`SELECT ${POOL_OFFICIAL_FIELDS.join(",")} FROM official_pool_result WHERE meeting_date=(SELECT MAX(meeting_date) FROM official_pool_result WHERE meeting_date<?) ORDER BY pool, rank_no LIMIT 60`, [data.date], POOL_OFFICIAL_FIELDS),
      read(`SELECT ${DRAW_OFFICIAL_FIELDS.join(",")} FROM official_draw_adv_stat WHERE racecourse IN (?,?) AND season_code=(SELECT MAX(season_code) FROM official_draw_adv_stat WHERE racecourse IN (?,?)) ORDER BY racecourse, course_label, distance_m, draw LIMIT 1200`, data.venue === "ST" ? ["STT", "STA", "STT", "STA"] : ["HVT", "HVT", "HVT", "HVT"], DRAW_OFFICIAL_FIELDS),
    ]);
    return { pools, draws };
  });