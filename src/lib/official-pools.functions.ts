import { createServerFn } from "@tanstack/react-start";
import { normalizeDividends, normalizeMeetings, normalizePoolStatus, normalizeProbes } from "./official-pools";

// 公開官方彩池／派彩／探針：固定查詢、只讀白名單欄位，不含任何預測或會員資料。
export const getOfficialPools = createServerFn({ method: "GET" })
  .inputValidator((input: { date?: string | undefined; venue?: string | undefined } | undefined) => {
    const date = input?.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : null;
    const venue = input?.venue === "ST" || input?.venue === "HV" ? input.venue : null;
    return { date, venue };
  })
  .handler(async ({ data }) => {
    const { publicRacingQuery } = await import("./public-racing-evidence.server");
    const read = async (sql: string, params: unknown[]) => {
      try { return { rows: await publicRacingQuery<Record<string, unknown>>(sql, params), ok: true }; }
      catch (e) { console.error("official pools read failed", e); return { rows: [] as Record<string, unknown>[], ok: false }; }
    };
    const list = await read(
      "SELECT meeting_date date, venue FROM official_pool_status UNION SELECT meeting_date, venue FROM official_pool_dividend UNION SELECT meeting_date, venue FROM official_track_probe ORDER BY 1 DESC LIMIT 60",
      [],
    );
    // 全部讀唔到要拋出等重試，唔可以當成「冇資料」快取。
    if (!list.ok) throw new Error("官方派彩存檔暫時讀取唔到");
    const meetings = normalizeMeetings(list.rows);
    const chosen = meetings.find((m) => m.date === data.date && (!data.venue || m.venue === data.venue)) ?? (data.date ? null : meetings[0] ?? null);
    if (!chosen) return { meetings, meeting: null, status: [], dividends: [], probes: [], failed: [] as string[] };
    const p = [chosen.date, chosen.venue];
    const [status, dividends, probes] = await Promise.all([
      read("SELECT odds_type pool, leg_no leg, race_nos races, sell_status status, jackpot_hkd jackpot, estimated_dividend_hkd estimated, merged_pool_id merged, scraped_at scrapedAt FROM official_pool_status WHERE meeting_date=? AND venue=? LIMIT 200", p),
      read("SELECT odds_type pool, leg_no leg, race_nos races, dividend_type kind, seq, win_comb combo, dividend_hkd amount, partial, partial_unit partialUnit, status FROM official_pool_dividend WHERE meeting_date=? AND venue=? LIMIT 400", p),
      read("SELECT instrument, reading_time time, reading FROM official_track_probe WHERE meeting_date=? AND venue=? LIMIT 40", p),
    ]);
    if (!status.ok && !dividends.ok && !probes.ok) throw new Error("官方派彩存檔暫時讀取唔到");
    return {
      meetings,
      meeting: chosen,
      status: normalizePoolStatus(status.rows),
      dividends: normalizeDividends(dividends.rows),
      probes: normalizeProbes(probes.rows),
      failed: [status.ok ? null : "彩池狀態", dividends.ok ? null : "官方派彩", probes.ok ? null : "場地探針"].filter(Boolean) as string[],
    };
  });
