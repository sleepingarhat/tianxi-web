import { createServerFn } from "@tanstack/react-start";
import { truncateRecent } from "./history-window";
import { TX_BASE } from "./tx-api";

type LockedEvidence = { horseElo: number | null; jockeyElo: number | null; trainerElo: number | null; factorScores: string | null; eloComposite: number | null; factorBonus: number | null; finalScore: number | null; generatedAt: string; modelVersion: string | null; rank: number; source: string | null; sire: string | null; dam: string | null; damsire: string | null; pedigreeUpdatedAt: string | null; provenance: "historical-unverified" | "public-frozen-picks" };
type VersionEvidence = { version: string; firstDate: string; lastDate: string; source: string | null; rows: number };

// Fixed projections only. No arbitrary SQL or database credentials cross the RPC boundary.
async function query<T>(sql: string, params: unknown[]): Promise<T[]> {
  const { publicRacingQuery } = await import('./public-racing-evidence.server');
  return publicRacingQuery<T>(sql, params);
}

export const getLockedEvidence = createServerFn({ method: "GET" })
  .inputValidator((input: { raceId: string; horseId: string }) => {
    if (!/^race_\d{4}-\d{2}-\d{2}_(ST|HV)_\d+$/.test(input.raceId) || !/^horse_[a-zA-Z0-9]+$/.test(input.horseId)) throw new Error("場次或馬匹識別無效");
    return input;
  })
  .handler(async ({ data }): Promise<LockedEvidence | null> => {
    // Historical settled evidence is public. Upcoming data follows the existing public
    // picks gate and is never exposed simply because a draft prediction_log row exists.
    const identities = await query<{ count: number }>(`SELECT COUNT(DISTINCT venue) count FROM race_meetings WHERE date=? AND venue IN ('ST','HV')`, [data.raceId.slice(5, 15)]);
    if (identities[0]?.count !== 1) throw new Error("同日馬場來源不唯一，暫不配對解釋紀錄");
    const settled = await query<{ settled: number }>(`SELECT 1 AS settled FROM race_results WHERE race_id=? AND finishing_position BETWEEN 1 AND 98 LIMIT 1`, [data.raceId]);
    if (!settled.length) {
      const response = await fetch(`${TX_BASE}/api/analyze/today-picks`, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) return null;
      const body = await response.json() as { frozen?: boolean; date?: string; races?: { raceId?: string; picks?: { horseId?: string }[] }[] };
      if (!body.frozen || body.date !== data.raceId.slice(5, 15) || !body.races?.some(r => r.raceId === data.raceId && r.picks?.some(p => p.horseId === data.horseId))) return null;
    }
    // Pedigree identity is a separate current reference, never historical locked evidence.
    const rows = await query<LockedEvidence>(`SELECT pl.horse_elo AS horseElo, pl.jockey_elo AS jockeyElo, pl.trainer_elo AS trainerElo, pl.factor_scores AS factorScores, pl.elo_composite AS eloComposite, pl.factor_bonus AS factorBonus, pl.final_score AS finalScore, pl.generated_at AS generatedAt, pl.lgb_model_version AS modelVersion, pl.predicted_rank AS rank, pl.score_source AS source,
      hp.sire AS sire, hp.dam AS dam, hp.dam_sire AS damsire, hp.updated_at AS pedigreeUpdatedAt
      FROM prediction_log pl JOIN races r ON r.race_number=pl.race_number JOIN race_meetings m ON m.id=r.meeting_id AND m.date=pl.date
      LEFT JOIN horse_pedigree hp ON hp.horse_id=pl.horse_id
      WHERE r.id=? AND pl.horse_id=? AND pl.engine='v12' AND pl.variant='baseline' AND pl.predicted_rank IS NOT NULL LIMIT 1`, [data.raceId, data.horseId]);
    const row = rows[0];
    return row ? { ...row, provenance: settled.length ? "historical-unverified" : "public-frozen-picks" } : null;
  });

export const getFrozenVersionHistory = createServerFn({ method: "GET" }).handler(async (): Promise<{ versions: VersionEvidence[]; truncated: boolean }> => {
  const { readVersionHistory } = await import('./version-history.server');
  return readVersionHistory();
});
