import { createServerFn } from "@tanstack/react-start";
import { normalizeArchivedChanges, normalizeChallenge, normalizeDrawStats, normalizeFocus, normalizeLastRun, normalizeRanking } from "./raceday-official";

// 公開官方統計；固定查詢、只讀公開欄位，不含預測或研究輸入。
export const getRacedayOfficial = createServerFn({ method: "GET" })
  .inputValidator((input: { date?: string; venue?: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input?.date ?? ""))) throw new Error("日期格式無效");
    if (input?.venue !== "ST" && input?.venue !== "HV") throw new Error("馬場無效");
    return { date: String(input.date), venue: input.venue === "HV" ? "HV" : "ST" };
  })
  .handler(async ({ data }) => {
    const { publicRacingQuery } = await import("./public-racing-evidence.server");
    const read = async (sql: string, params: unknown[]) => {
      try { return { rows: await publicRacingQuery<Record<string, unknown>>(sql, params), ok: true }; }
      catch (e) { console.error("raceday official read failed", e); return { rows: [] as Record<string, unknown>[], ok: false }; }
    };
    const [ranking, draws, changes, challengePools, challengeRows, focus, lastRun] = await Promise.all([
      read("SELECT role, board_rank rank, name_ch name, wins, seconds, thirds, starts, as_of_date asOf, season_code season FROM official_ranking_board WHERE racecourse='ALL' AND season_scope='current' AND section='service' AND as_of_date=(SELECT MAX(as_of_date) FROM official_ranking_board WHERE racecourse='ALL' AND season_scope='current' AND as_of_date<=?) ORDER BY role, board_rank LIMIT 60", [data.date]),
      read("SELECT race_no raceNumber, draw, starts, win_pct winPct, place_pct placePct, distance_m distance, course_label course FROM official_draw_stat WHERE meeting_date=? AND venue=? ORDER BY race_no, draw LIMIT 300", [data.date, data.venue]),
      read("SELECT race_number raceNumber, horse_number horseNumber, horse_name horseName, change_type changeType, after_value after FROM racing_changes WHERE race_date=? AND venue=? ORDER BY race_number LIMIT 200", [data.date, data.venue]),
      read("SELECT odds_type kind, pool_status status, include_races races FROM official_challenge_pool WHERE meeting_date=? AND venue=? LIMIT 4", [data.date, data.venue]),
      read("SELECT odds_type kind, person_name_ch name, odds_text odds, final_order finalOrder, accumulated_points points, scheduled_rides rides, is_other isOther FROM official_challenge_selection WHERE meeting_date=? AND venue=? LIMIT 120", [data.date, data.venue]),
      read("SELECT title_ch title, highlight_ch lead, source_url url FROM official_raceday_focus WHERE meeting_date=? AND venue=? LIMIT 1", [data.date, data.venue]),
      read("SELECT race_no raceNumber, horse_no horseNumber, horse_name_ch horseName, last_date lastDate, last_venue lastVenue, last_track_ch track, last_class cls, last_distance_m distance, last_draw draw, running_positions positions, memo_ch memo, page_updated_at updatedAt FROM official_last_run_reminder WHERE meeting_date=? AND venue=? ORDER BY race_no, horse_no LIMIT 120", [data.date, data.venue]),
    ]);
    return {
      ranking: normalizeRanking(ranking.rows),
      draws: normalizeDrawStats(draws.rows),
      changes: normalizeArchivedChanges(changes.rows),
      challenge: normalizeChallenge(challengePools.rows, challengeRows.rows),
      focus: normalizeFocus(focus.rows),
      lastRun: normalizeLastRun(lastRun.rows),
      failed: [ranking.ok ? null : "騎練榜", draws.ok ? null : "檔位統計", changes.ok ? null : "更易存檔", challengePools.ok && challengeRows.ok ? null : "騎師王／練馬師王", focus.ok ? null : "賽日頭條", lastRun.ok ? null : "上仗備忘"].filter(Boolean) as string[],
    };
  });
