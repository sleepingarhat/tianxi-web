import { createServerFn } from "@tanstack/react-start";
import { TX_BASE } from "./tx-api";

type LockedEvidence = { horseElo: number | null; jockeyElo: number | null; trainerElo: number | null; factorScores: string | null; eloComposite: number | null; factorBonus: number | null; finalScore: number | null; generatedAt: string; modelVersion: string | null; rank: number; source: string | null; sire: string | null; dam: string | null; damsire: string | null; pedigreeUpdatedAt: string | null; provenance: "historical-unverified" | "public-frozen-picks" };
type VersionEvidence = { version: string; firstDate: string; lastDate: string; source: string | null; rows: number };

// Fixed projections only. No arbitrary SQL or database credentials cross the RPC boundary.
async function query<T>(sql: string, params: unknown[], token: string, account: string): Promise<T[]> {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/aad1636e-869a-43f5-aa95-4a19e3aa5517/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }), signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json() as { success?: boolean; result?: { results?: T[] }[] };
  if (!response.ok || !body.success) throw new Error("凍結資料暫時未能讀取");
  return body.result?.[0]?.results ?? [];
}

export const getLockedEvidence = createServerFn({ method: "GET" })
  .inputValidator((input: { raceId: string; horseId: string }) => {
    if (!/^race_\d{4}-\d{2}-\d{2}_(ST|HV)_\d+$/.test(input.raceId) || !/^horse_[a-zA-Z0-9]+$/.test(input.horseId)) throw new Error("場次或馬匹識別無效");
    return input;
  })
  .handler(async ({ data }): Promise<LockedEvidence | null> => {
    const token = process.env["CLOUDFLARE_API_TOKEN"], account = process.env["CLOUDFLARE_ACCOUNT_ID"];
    if (!token || !account) throw new Error("凍結資料暫時未能讀取");
    // Historical settled evidence is public. Upcoming data follows the existing public
    // picks gate and is never exposed simply because a draft prediction_log row exists.
    const identities = await query<{ count: number }>(`SELECT COUNT(DISTINCT venue) count FROM race_meetings WHERE date=? AND venue IN ('ST','HV')`, [data.raceId.slice(5, 15)], token, account);
    if (identities[0]?.count !== 1) throw new Error("同日馬場來源不唯一，暫不配對解釋紀錄");
    const settled = await query<{ settled: number }>(`SELECT 1 AS settled FROM race_results WHERE race_id=? AND finishing_position BETWEEN 1 AND 98 LIMIT 1`, [data.raceId], token, account);
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
      WHERE r.id=? AND pl.horse_id=? AND pl.engine='v12' AND pl.variant='baseline' AND pl.predicted_rank IS NOT NULL LIMIT 1`, [data.raceId, data.horseId], token, account);
    const row = rows[0];
    return row ? { ...row, provenance: settled.length ? "historical-unverified" : "public-frozen-picks" } : null;
  });

export const getFrozenVersionHistory = createServerFn({ method: "GET" }).handler(async (): Promise<VersionEvidence[]> => {
  const token = process.env["CLOUDFLARE_API_TOKEN"], account = process.env["CLOUDFLARE_ACCOUNT_ID"];
  if (!token || !account) throw new Error("版本紀錄暫時未能讀取");
  return query<VersionEvidence>(`SELECT pl.lgb_model_version AS version, MIN(pl.date) AS firstDate, MAX(pl.date) AS lastDate, pl.score_source AS source, COUNT(*) AS rows
    FROM prediction_log pl WHERE pl.engine='v12' AND pl.variant='baseline' AND pl.predicted_rank IS NOT NULL AND pl.lgb_model_version IS NOT NULL
    AND (SELECT COUNT(DISTINCT m.venue) FROM race_meetings m WHERE m.date=pl.date AND m.venue IN ('ST','HV'))=1
    AND EXISTS(SELECT 1 FROM race_meetings m JOIN races r ON r.meeting_id=m.id JOIN race_results rr ON rr.race_id=r.id WHERE m.date=pl.date AND r.race_number=pl.race_number AND rr.finishing_position BETWEEN 1 AND 98)
    GROUP BY pl.lgb_model_version,pl.score_source ORDER BY firstDate DESC LIMIT 100`, [], token, account);
});