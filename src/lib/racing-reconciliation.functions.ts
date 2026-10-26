import { createServerFn } from "@tanstack/react-start";
import { truncateRecent } from "./history-window";
import { validRacingDate, predictionTiming, snapshotChanges, type EloSnapshot } from "./racing-reconciliation";

export const getReconciliationDates = createServerFn({ method: "GET" }).handler(async () => {
  const { publicRacingQuery } = await import("./public-racing-evidence.server");
  const rows = await publicRacingQuery<{ date: string }>("SELECT DISTINCT m.date FROM race_meetings m JOIN races r ON r.meeting_id=m.id JOIN race_results rr ON rr.race_id=r.id WHERE m.venue IN ('ST','HV') AND rr.finishing_position BETWEEN 1 AND 98 ORDER BY m.date DESC LIMIT 401");
  // 上限只保留「最新」400 個賽日；截斷就標示，唔可以靜靜雞剔走任何一端。
  const win = truncateRecent(rows, 400, (r) => r.date);
  return { days: win.items, truncated: win.truncated };
});

export type ReconciliationRow = { raceId: string; raceNumber: number; venue: string; horseId: string; name: string; horseNumber: number; predictionHorseNumber: number | null; startTime: string | null; rank: number | null; horseElo: number | null; jockeyElo: number | null; trainerElo: number | null; composite: number | null; score: number | null; lgb: number | null; finish: number | null; loggedFinish: number | null; generatedAt: string | null; version: string | null; source: string | null };
export const getPredictionReconciliation = createServerFn({ method: "GET" }).inputValidator((input: { date: string }) => ({ date: validRacingDate(input.date) })).handler(async ({ data }) => {
  const { publicRacingQuery: query } = await import("./public-racing-evidence.server");
  // All-runner disclosure is settled-only; draft records never pass this guard.
  const meetings = await query<{ venue: string }>("SELECT DISTINCT m.venue FROM race_meetings m JOIN races r ON r.meeting_id=m.id JOIN race_results rr ON rr.race_id=r.id WHERE m.date=? AND m.venue IN ('ST','HV') AND rr.finishing_position BETWEEN 1 AND 98", [data.date]);
  if (!meetings.length) return { date: data.date, rows: [], unavailable: true };
  const identities = await query<{ count: number }>("SELECT COUNT(DISTINCT venue) count FROM race_meetings WHERE date=? AND venue IN ('ST','HV')", [data.date]);
  if (meetings.length !== 1 || identities[0]?.count !== 1) throw new Error("同日馬場來源不唯一，暫不配對預測紀錄");
  const rows = await query<ReconciliationRow>(`WITH target AS (
    SELECT r.id,r.race_number,r.start_time,m.venue FROM races r JOIN race_meetings m ON m.id=r.meeting_id WHERE m.date=? AND m.venue=?
    AND EXISTS(SELECT 1 FROM race_results z WHERE z.race_id=r.id AND z.finishing_position BETWEEN 1 AND 98)), runners AS (
    SELECT t.id race_id,rr.horse_id FROM target t JOIN race_results rr ON rr.race_id=t.id
    UNION SELECT t.id,pl.horse_id FROM target t JOIN prediction_log pl ON pl.race_number=t.race_number WHERE pl.date=? AND pl.engine='v12' AND pl.variant='baseline')
    SELECT t.id raceId,t.race_number raceNumber,t.venue,k.horse_id horseId,h.name_ch name,COALESCE(rr.horse_number,pl.horse_number) horseNumber,pl.horse_number predictionHorseNumber,t.start_time startTime,
    pl.predicted_rank rank,pl.horse_elo horseElo,pl.jockey_elo jockeyElo,pl.trainer_elo trainerElo,pl.elo_composite composite,pl.final_score score,pl.lgb_score lgb,
    rr.finishing_position finish,pl.actual_finish loggedFinish,pl.generated_at generatedAt,pl.lgb_model_version version,pl.score_source source
    FROM runners k JOIN target t ON t.id=k.race_id LEFT JOIN race_results rr ON rr.race_id=t.id AND rr.horse_id=k.horse_id
    LEFT JOIN prediction_log pl ON pl.date=? AND pl.race_number=t.race_number AND pl.horse_id=k.horse_id AND pl.engine='v12' AND pl.variant='baseline'
    LEFT JOIN horses h ON h.id=k.horse_id ORDER BY t.race_number,pl.predicted_rank IS NULL,pl.predicted_rank,k.horse_id`, [data.date, meetings[0]?.venue, data.date, data.date]);
  const [{ viewerTier }, { projectReconciliationRows }, { setResponseHeader }] = await Promise.all([
    import('./picks-entitlement.server'), import('./reconciliation-projection'), import('@tanstack/react-start/server'),
  ]);
  setResponseHeader('Cache-Control', 'private, no-store');
  return { date: data.date, unavailable: false, rows: projectReconciliationRows(rows.map(row => ({ ...row, timing: predictionTiming(row.generatedAt, data.date, row.startTime) })), await viewerTier()) };
});

export const getEloDailyLog = createServerFn({ method: "GET" }).inputValidator((input: { date: string }) => ({ date: validRacingDate(input.date) })).handler(async ({ data }) => {
  const { publicRacingQuery: query } = await import("./public-racing-evidence.server");
  const union = `SELECT s.id,'horse' entityType,s.horse_id entityId,h.name_ch name,s.as_of_date date,s.rating,s.is_season_end season,s.computed_at computedAt FROM horse_elo_snapshots s LEFT JOIN horses h ON h.id=s.horse_id WHERE s.id LIKE 'v12:%' AND s.axis_key='overall'
    UNION ALL SELECT s.id,'jockey',s.jockey_id,j.name_ch,s.as_of_date,s.rating,s.is_season_end,s.computed_at FROM jockey_elo_snapshots s LEFT JOIN jockeys j ON j.id=s.jockey_id WHERE s.id LIKE 'v12:%'
    UNION ALL SELECT s.id,'trainer',s.trainer_id,t.name_ch,s.as_of_date,s.rating,s.is_season_end,s.computed_at FROM trainer_elo_snapshots s LEFT JOIN trainers t ON t.id=s.trainer_id WHERE s.id LIKE 'v12:%'`;
  const snapshots = await query<EloSnapshot>(`WITH all_s AS (${union}), entities AS(SELECT DISTINCT entityType,entityId FROM all_s WHERE date=?) SELECT s.* FROM all_s s JOIN entities e ON e.entityType=s.entityType AND e.entityId=s.entityId WHERE s.date=? OR s.date=(SELECT MAX(p.date) FROM all_s p WHERE p.entityType=s.entityType AND p.entityId=s.entityId AND p.date<?)`, [data.date, data.date, data.date]);
  const mapping = await query<{ sourceRace: number; venue: string; raceId: string; raceNumber: number; horses: number; sourceHorses: number; resultHorses: number }>(`SELECT f.race_number sourceRace,m.venue,r.id raceId,r.race_number raceNumber,COUNT(DISTINCT f.horse_id) horses,
    (SELECT COUNT(DISTINCT x.horse_id) FROM horse_form_records x WHERE x.race_date=f.race_date AND x.venue=f.venue AND x.race_number=f.race_number) sourceHorses, (SELECT COUNT(DISTINCT z.horse_id) FROM race_results z WHERE z.race_id=r.id) resultHorses
    FROM horse_form_records f JOIN race_results rr ON rr.horse_id=f.horse_id JOIN races r ON r.id=rr.race_id JOIN race_meetings m ON m.id=r.meeting_id AND m.date=f.race_date AND m.venue=f.venue
    WHERE f.race_date=? GROUP BY f.race_number,m.venue,r.id,r.race_number`, [data.date]);
  const rows = snapshotChanges(snapshots).filter(row => row.date === data.date).map(row => {
    const candidates = mapping.filter(m => m.sourceRace === row.sourceRace && m.venue === row.venue);
    const match = candidates.length === 1 && candidates[0]?.horses === candidates[0]?.sourceHorses && candidates[0]?.horses === candidates[0]?.resultHorses ? candidates[0] : null;
    return { ...row, raceId: match?.raceId ?? null, raceNumber: match?.raceNumber ?? null };
  });
  return { date: data.date, rows, computedAt: rows.map(r => r.computedAt).sort().at(-1) ?? null };
});

export const getPositionHistory = createServerFn({ method: "GET" }).inputValidator((input: { horseId: string; date: string }) => {
  if (!/^horse_[a-zA-Z0-9]+$/.test(input.horseId)) throw new Error("馬匹識別無效");
  return { horseId: input.horseId, date: validRacingDate(input.date) };
}).handler(async ({ data }) => {
  const { publicRacingQuery: query } = await import("./public-racing-evidence.server");
  return query<{ date: string; distance: number; runningPosition: string; fieldSize: number }>(`SELECT m.date,r.distance,rr.running_position runningPosition,(SELECT COUNT(*) FROM race_results z WHERE z.race_id=r.id) fieldSize FROM race_results rr JOIN races r ON r.id=rr.race_id JOIN race_meetings m ON m.id=r.meeting_id WHERE rr.horse_id=? AND m.date<? AND rr.running_position IS NOT NULL ORDER BY m.date DESC,r.race_number DESC LIMIT 50`, [data.horseId, data.date]);
});
