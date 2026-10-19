import { publicRacingQuery as query } from './public-racing-evidence.server';
import { frozenColumns, validateFrozenSnapshot, type FrozenRow } from './frozen-racing';
import { verifyRunnerIdentities, type RunnerIdentity } from './racing-runner-identity';

/** SELECT only. Never calls compute, capture or recovery. */
export async function readFrozenRacing(date: string) {
  const saved = await query<{ snapshot_json: string; sha256: string; captured_at: string; ok: number | null }>(`SELECT s.snapshot_json,s.sha256,s.captured_at,p.ok FROM prediction_original_snapshots s LEFT JOIN prediction_recovery_status p ON p.date=s.date AND p.engine=s.engine WHERE s.date=? AND s.engine='v12'`,[date]);
  const original = saved[0];
  if (!original || original.ok !== 1) throw new Error('未有可核實原始凍結副本，暫停提供最終預測');
  const [rows, metas] = await Promise.all([
    query<FrozenRow>(`SELECT ${frozenColumns.join(',')} FROM prediction_log WHERE date=? AND engine='v12' AND variant='baseline' ORDER BY race_number,predicted_rank`,[date]),
    query<FrozenRow>("SELECT * FROM prediction_lock_meta WHERE date=? AND engine='v12'",[date]),
  ]);
  const snapshot = await validateFrozenSnapshot(original,date,rows,metas[0] ?? null);
  const [raceInfo, resultRows, names, meeting, card] = await Promise.all([
    query<FrozenRow>(`SELECT r.id raceId,r.race_number raceNumber,r.start_time startTime,r.title,r.class,r.distance,r.going,r.track,r.course FROM races r JOIN race_meetings m ON m.id=r.meeting_id WHERE m.date=? AND m.venue=? ORDER BY r.race_number`,[date,snapshot.venue]),
    query<FrozenRow>(`SELECT r.race_number raceNumber,rr.horse_id horseId,rr.horse_number horseNumber,rr.finishing_position finishingPosition,rr.win_odds winOdds,rr.running_position runningPosition FROM race_results rr JOIN races r ON r.id=rr.race_id JOIN race_meetings m ON m.id=r.meeting_id WHERE m.date=? AND m.venue=? ORDER BY r.race_number,rr.finishing_position`,[date,snapshot.venue]),
    query<FrozenRow>(`SELECT DISTINCT h.id horseId,h.name_ch nameCh,h.name_en nameEn FROM horses h JOIN prediction_log p ON p.horse_id=h.id WHERE p.date=? AND p.engine='v12' AND p.variant='baseline'`,[date]),
    fetch(`https://tianxi-backend.tianxi-entertainment.workers.dev/api/meetings/${date}`,{cache:'no-store',signal:AbortSignal.timeout(15_000)}).then(async r=>r.ok ? await r.json() as {venue?:string;trackCondition?:string;races?:FrozenRow[]} : null).catch(()=>null),
    query<RunnerIdentity>(`SELECT race_number raceNumber,horse_number horseNumber,horse_id horseId FROM entries_upcoming WHERE race_date=? AND venue=? AND race_number>0 ORDER BY race_number,horse_number`,[date,snapshot.venue]),
  ]);
  const identityCheck = verifyRunnerIdentities(snapshot.rows.map(r=>({raceNumber:r.race_number,horseNumber:r.horse_number,horseId:r.horse_id})),card,resultRows.map(r=>({raceNumber:r.raceNumber,horseNumber:r.horseNumber,horseId:r.horseId})));
  const nameMap = new Map(names.map(n=>[n.horseId,n]));
  const config = JSON.parse(snapshot.meta.config || '{}');
  const raceNumbers = [...new Set(snapshot.rows.map(r=>r.race_number))].sort((a,b)=>a-b);
  const races = raceNumbers.map(raceNumber => {
    const info: FrozenRow = raceInfo.find(r=>r.raceNumber===raceNumber) ?? (meeting?.venue===snapshot.venue ? meeting.races?.find(r=>r.raceNumber===raceNumber) : undefined) ?? {};
    const frozen = snapshot.rows.filter(r=>r.race_number===raceNumber).sort((a,b)=>a.predicted_rank-b.predicted_rank);
    const results = resultRows.filter(r=>r.raceNumber===raceNumber);
    return {
      raceNumber, raceId: info.raceId ?? `race_${date}_${snapshot.venue}_${raceNumber}`,startTime:info.startTime ?? null,title:info.title ?? null,class:info.class ?? null,distance:info.distance ?? null,going:info.going ?? null,track:info.track ?? null,course:info.course ?? null,
      scoreSource: frozen.some(r=>r.lgb_score != null) ? 'lgb' : 'elo', ensembleAlpha: config.alpha ?? null,
      predictedTop4: frozen.slice(0,4).map(r=>r.horse_number),
      picks: frozen.map(r=>({ horseId:r.horse_id,horseNumber:r.horse_number,nameCh:nameMap.get(r.horse_id)?.nameCh,nameEn:nameMap.get(r.horse_id)?.nameEn,draw:r.draw || null,rank:r.predicted_rank,finalScore:r.final_score,pWin:r.p_win,pTop3:r.p_top3,pTop4:null,horseElo:r.horse_elo,jockeyElo:r.jockey_elo,trainerElo:r.trainer_elo,eloComposite:r.elo_composite,factorBonus:r.factor_bonus,factorScores:r.factor_scores,scoreSource:r.score_source,lgbScore:r.lgb_score,generatedAt:r.generated_at,modelVersion:r.lgb_model_version })),
      resultsStatus: results.length ? 'available' : 'pending', results,
    };
  });
  return { schemaVersion:1,date,venue:snapshot.venue,edition:'final' as const,frozen:true,source:'verified-original-snapshot',lockAt:snapshot.lockAt,generatedAt:snapshot.rows[0]?.generated_at,verifiedAt:new Date().toISOString(),snapshot:{sha256:original.sha256,capturedAt:original.captured_at,rows:snapshot.rows.length,races:races.length,captureTiming:Date.parse(original.captured_at)>Date.parse(snapshot.lockAt)?'after-lock':'at-or-before-lock'},probabilityEvidence:{pTop4:'not-saved-in-original'},identityEvidence:'current-card-cross-check-not-prelock-provenance',identityCheck,resultsSource:'official-race-results',races };
}