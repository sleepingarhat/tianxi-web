import { createServerFn } from "@tanstack/react-start";
import { truncateRecent } from "./history-window";
import { TX_BASE } from "./tx-api";
import { evidenceIdentity, frozenEvidenceAllows, type FrozenEvidenceBody } from './locked-evidence-access';

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
    const { setResponseHeader } = await import('@tanstack/react-start/server');
    setResponseHeader('Cache-Control', 'private, no-store');
    const identity = evidenceIdentity(data.raceId, data.horseId);
    // Historical settled evidence is public. Upcoming data follows the existing public
    // picks gate and is never exposed simply because a draft prediction_log row exists.
    const identities = await query<{ count: number }>(`SELECT COUNT(DISTINCT venue) count FROM race_meetings WHERE date=? AND venue IN ('ST','HV')`, [data.raceId.slice(5, 15)]);
    if (identities[0]?.count !== 1) throw new Error("同日馬場來源不唯一，暫不配對解釋紀錄");
    const settled = await query<{ settled: number }>(`SELECT 1 AS settled FROM race_results WHERE race_id=? AND finishing_position BETWEEN 1 AND 98 LIMIT 1`, [data.raceId]);
    // PRO_ENFORCEMENT=on：伺服器按 FEATURE_TIERS 核實（賽後 explain.postrace=registered；賽前 explain.prerace=pro），
    // 唔再只靠前端 TierGate。預設 off，同現況一樣。
    const { proEnforcementEnabled, lockedEvidenceAllowed, projectLockedEvidence } = await import('./picks-projection');
    const enforce = proEnforcementEnabled();
    const tier = enforce ? await (await import('./picks-entitlement.server')).viewerTier() : null;
    if (tier && !lockedEvidenceAllowed(tier, settled.length > 0)) return null;
    if (!settled.length) {
      // 會籍單一來源：兩條路都係 loadUserTier → rpc my_entitlement()。PRO_ENFORCEMENT=on 時沿用上面已核實嘅 tier，唔再查第二次。
      const pro = tier ? tier === 'pro' : await (await import('./evidence-viewer.server')).evidenceViewerIsPro();
      if (!pro && identity.raceNumber !== 1) return null;
      const token = pro ? process.env['TIANXI_ADMIN_TOKEN'] : undefined;
      if (pro && !token) throw new Error('凍結解釋讀取憑證未設定');
      const response = await fetch(`${TX_BASE}/api/analyze/today-picks`, { cache: 'no-store', signal: AbortSignal.timeout(15_000), headers: token ? { authorization: `Bearer ${token}` } : {} });
      if (!response.ok) return null;
      const body = await response.json() as FrozenEvidenceBody;
      if (!frozenEvidenceAllows(body, identity, pro)) return null;
      // Worker visibility is not proof that a mutable log still matches its original lock.
      const { frozenColumns, validateFrozenSnapshot, frozenEvidenceStatus } = await import('./frozen-racing');
      const [saved, current, metas] = await Promise.all([
        query<{ snapshot_json: string; sha256: string; ok: number | null }>(`SELECT s.snapshot_json,s.sha256,p.ok FROM prediction_original_snapshots s LEFT JOIN prediction_recovery_status p ON p.date=s.date AND p.engine=s.engine WHERE s.date=? AND s.engine='v12'`, [identity.date]),
        query<import('./frozen-racing').FrozenRow>(`SELECT ${frozenColumns.join(',')} FROM prediction_log WHERE date=? AND engine='v12' AND variant='baseline' ORDER BY race_number,predicted_rank`, [identity.date]),
        query<import('./frozen-racing').FrozenRow>(`SELECT * FROM prediction_lock_meta WHERE date=? AND engine='v12'`, [identity.date]),
      ]);
      const original = saved[0];
      if (!original || frozenEvidenceStatus(original) !== 'available') return null;
      const snapshot = await validateFrozenSnapshot(original, identity.date, current, metas[0] ?? null);
      if (snapshot.venue !== identity.venue || !snapshot.rows.some(r => r.race_number === identity.raceNumber && r.horse_id === identity.horseId)) return null;
    }
    // Pedigree identity is a separate current reference, never historical locked evidence.
    const rows = await query<LockedEvidence>(`SELECT pl.horse_elo AS horseElo, pl.jockey_elo AS jockeyElo, pl.trainer_elo AS trainerElo, pl.factor_scores AS factorScores, pl.elo_composite AS eloComposite, pl.factor_bonus AS factorBonus, pl.final_score AS finalScore, pl.generated_at AS generatedAt, pl.lgb_model_version AS modelVersion, pl.predicted_rank AS rank, pl.score_source AS source,
      hp.sire AS sire, hp.dam AS dam, hp.dam_sire AS damsire, hp.updated_at AS pedigreeUpdatedAt
      FROM prediction_log pl
      LEFT JOIN horse_pedigree hp ON hp.horse_id=pl.horse_id
      WHERE pl.date=? AND pl.race_number=? AND pl.horse_id=? AND pl.engine='v12' AND pl.variant='baseline' AND pl.predicted_rank IS NOT NULL LIMIT 1`, [identity.date, identity.raceNumber, data.horseId]);
    const row = rows[0];
    if (!row) return null;
    const evidence: LockedEvidence = { ...row, provenance: settled.length ? "historical-unverified" : "public-frozen-picks" };
    // 回傳一律逐欄允許清單（LOCKED_EVIDENCE_SPEC），唔會因為 SELECT 加欄就外洩。
    return projectLockedEvidence(evidence, tier ?? 'guest');
  });

export const getFrozenVersionHistory = createServerFn({ method: "GET" }).handler(async (): Promise<{ versions: VersionEvidence[]; truncated: boolean }> => {
  const { readVersionHistory } = await import('./version-history.server');
  return readVersionHistory();
});
