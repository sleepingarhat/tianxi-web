import { truncateRecent } from "./history-window";
import { publicRacingQuery as query } from "./public-racing-evidence.server";
export type VersionEvidence = { version: string; firstDate: string; lastDate: string; source: string | null; rows: number };
export async function readVersionHistory(): Promise<{ versions: VersionEvidence[]; truncated: boolean }> {
  const rows = await query<VersionEvidence>(`SELECT pl.lgb_model_version AS version, MIN(pl.date) AS firstDate, MAX(pl.date) AS lastDate, pl.score_source AS source, COUNT(*) AS rows
    FROM prediction_log pl WHERE pl.engine='v12' AND pl.variant='baseline' AND pl.predicted_rank IS NOT NULL AND pl.lgb_model_version IS NOT NULL
    AND (SELECT COUNT(DISTINCT m.venue) FROM race_meetings m WHERE m.date=pl.date AND m.venue IN ('ST','HV'))=1
    AND EXISTS(SELECT 1 FROM race_meetings m JOIN races r ON r.meeting_id=m.id JOIN race_results rr ON rr.race_id=r.id WHERE m.date=pl.date AND r.race_number=pl.race_number AND rr.finishing_position BETWEEN 1 AND 98)
    GROUP BY pl.lgb_model_version,pl.score_source ORDER BY firstDate DESC LIMIT 101`, []);
  const win = truncateRecent(rows, 100, (r) => r.firstDate);
  return { versions: win.items, truncated: win.truncated };
}
