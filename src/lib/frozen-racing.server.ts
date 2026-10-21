import { publicRacingQuery as query } from './public-racing-evidence.server';
import { frozenColumns, validateFrozenSnapshot, FrozenEvidenceError, frozenEvidenceStatus, type FrozenRow } from './frozen-racing';
import { verifyRunnerIdentities, resultsForFrozenIdentity, type RunnerIdentity } from './racing-runner-identity';
import { officialWithdrawal, type HkjcChange } from './hkjc-changes';
import { effectiveTop4 } from './withdrawal-substitution';
import { officialRaceMetric } from './racing-official-metrics';
import { mergeMeetingMetadata, type RacingMeetingMetadata } from './racing-meeting-metadata';
import { readChangesEvidence, changesAwareStatus } from './changes-evidence';
import { optionalRacingReference } from './optional-racing-reference';

/** SELECT only. Never calls compute, capture or recovery. */
export async function readFrozenRacing(date: string) {
  // Independent mandatory reads run together; all must still pass validation.
  const [saved, rows, metas] = await Promise.all([
    query<{ snapshot_json: string; sha256: string; captured_at: string; ok: number | null }>(`SELECT s.snapshot_json,s.sha256,s.captured_at,p.ok FROM prediction_original_snapshots s LEFT JOIN prediction_recovery_status p ON p.date=s.date AND p.engine=s.engine WHERE s.date=? AND s.engine='v12'`,[date]),
    query<FrozenRow>(`SELECT ${frozenColumns.join(',')} FROM prediction_log WHERE date=? AND engine='v12' AND variant='baseline' ORDER BY race_number,predicted_rank`,[date]),
    query<FrozenRow>("SELECT * FROM prediction_lock_meta WHERE date=? AND engine='v12'",[date]),
  ]);
  const original = saved[0];
  const evidence = frozenEvidenceStatus(original);
  if (!original || evidence !== 'available') {
    throw new FrozenEvidenceError(evidence, evidence === 'no-archive'
      ? '呢個賽日未有已核實嘅原始凍結副本（凍結存證未建立），故唔會展示該日最終預測'
      : '原始凍結副本嘅核實狀態未確認，暫停提供最終預測');
  }
  let snapshot; try { snapshot = await validateFrozenSnapshot(original,date,rows,metas[0] ?? null); }
  catch (error) { throw new FrozenEvidenceError('verification-failed', error instanceof Error ? error.message : '凍結副本核實失敗'); }
  const [raceInfo, legacyResultRows, names, meeting, card, officialSnap, cardInfo, cloudResults] = await Promise.all([
    query<FrozenRow>(`SELECT r.id raceId,r.race_number raceNumber,r.start_time startTime,r.title,r.class,r.distance,r.going,r.track,r.course FROM races r JOIN race_meetings m ON m.id=r.meeting_id WHERE m.date=? AND m.venue=? ORDER BY r.race_number`,[date,snapshot.venue]),
    query<FrozenRow>(`SELECT r.race_number raceNumber,rr.horse_id horseId,rr.horse_number horseNumber,rr.finishing_position finishingPosition,rr.win_odds winOdds,rr.running_position runningPosition FROM race_results rr JOIN races r ON r.id=rr.race_id JOIN race_meetings m ON m.id=r.meeting_id WHERE m.date=? AND m.venue=? ORDER BY r.race_number,rr.finishing_position`,[date,snapshot.venue]),
    query<FrozenRow>(`SELECT DISTINCT h.id horseId,h.name_ch nameCh,h.name_en nameEn FROM horses h JOIN prediction_log p ON p.horse_id=h.id WHERE p.date=? AND p.engine='v12' AND p.variant='baseline'`,[date]),
    optionalRacingReference(async signal => {
      const r = await fetch(`https://tianxi-backend.tianxi-entertainment.workers.dev/api/meetings/${date}`, { cache: 'no-store', signal });
      return r.ok ? await r.json() as {venue?:string;trackCondition?:string;races?:FrozenRow[]} : null;
    }),
    query<RunnerIdentity>(`SELECT race_number raceNumber,horse_number horseNumber,horse_id horseId FROM entries_upcoming WHERE race_date=? AND venue=? AND race_number>0 ORDER BY race_number,horse_number`,[date,snapshot.venue]),
    readChangesEvidence(()=>import('./hkjc-changes.server').then(m=>m.readLatestHkjcChanges(date,snapshot.venue))),
    query<RacingMeetingMetadata>(`SELECT race_number raceNumber,
      CASE WHEN COUNT(DISTINCT post_time)=1 THEN MIN(post_time) END startTime,
      CASE WHEN COUNT(DISTINCT distance)=1 THEN MIN(distance) END distance,
      CASE WHEN COUNT(DISTINCT race_class)=1 THEN MIN(race_class) END class,
      CASE WHEN COUNT(DISTINCT track)=1 THEN MIN(track) END track,
      CASE WHEN COUNT(DISTINCT course)=1 THEN MIN(course) END course
      FROM entries_upcoming WHERE race_date=? AND venue=? AND race_number>0 GROUP BY race_number`,[date,snapshot.venue]),
    import('./hkjc-results-collector.server').then(m=>m.readCloudOfficialResults(date,snapshot.venue)),
  ]);
  const cloudRaceNumbers = new Set(cloudResults.map(r=>r.raceNumber));
  const resultRows: FrozenRow[] = [...legacyResultRows.filter(r=>!cloudRaceNumbers.has(r.raceNumber)),...cloudResults.flatMap(r=>r.results)];
  const nameMap = new Map(names.map(n=>[n.horseId,n]));
  // Official HKJC changes (archived snapshot with SHA) may explain a slot change; the frozen row itself is never rewritten.
  const changesReadOk = officialSnap.ok;
  const snap = officialSnap.ok ? officialSnap.snapshot : null;
  const officialChanges: HkjcChange[] = snap && snap.venue===snapshot.venue ? (snap.changes as unknown as HkjcChange[]) : [];
  const extraIds = [...new Set(resultRows.map(r => r.horseId).filter((id): id is string => typeof id === 'string' && /^horse_[A-Za-z0-9]+$/.test(id) && !nameMap.has(id)))];
  if (extraIds.length > 400) throw new Error('官方賽果身份行數超出核對範圍');
  const extraNames = extraIds.length ? await query<FrozenRow>(`SELECT id horseId,name_ch nameCh,name_en nameEn FROM horses WHERE id IN (${extraIds.map(() => '?').join(',')})`, extraIds) : [];
  for (const row of extraNames) nameMap.set(row.horseId, row);
  const verifiedWithdrawnIds = new Set(resultRows.filter(r => r.finishingPosition == null && officialWithdrawal(officialChanges, r.raceNumber, r.horseNumber, nameMap.get(r.horseId)?.nameCh, r.horseId)).map(r => `${r.raceNumber}:${r.horseId}`));
  const changeFor = (r:FrozenRow) => officialWithdrawal(officialChanges, r.race_number, r.horse_number, nameMap.get(r.horse_id)?.nameCh);
  const withdrawn = new Set(snapshot.rows.filter(r=>changeFor(r)).map(r=>`${r.race_number}:${r.horse_number}`));
  const frozenIdentities = snapshot.rows.map(r=>({raceNumber:r.race_number,horseNumber:r.horse_number,horseId:r.horse_id}));
  const identityResults = resultsForFrozenIdentity(frozenIdentities, resultRows.map(r=>({raceNumber:r.raceNumber,horseNumber:r.horseNumber,horseId:r.horseId,finishingPosition:r.finishingPosition})), verifiedWithdrawnIds);
  const identityCheck = verifyRunnerIdentities(frozenIdentities,card,identityResults,withdrawn);
  const config = JSON.parse(snapshot.meta.config || '{}');
  const raceNumbers = [...new Set(snapshot.rows.map(r=>r.race_number))].sort((a,b)=>a-b);
  const races = raceNumbers.map(raceNumber => {
    const resultInfo = raceInfo.find(r=>r.raceNumber===raceNumber);
    const meetingInfo = meeting?.venue===snapshot.venue ? meeting.races?.find(r=>r.raceNumber===raceNumber) : undefined;
    const cardReference = cardInfo.find(r=>r.raceNumber===raceNumber);
    const info = mergeMeetingMetadata(resultInfo, meetingInfo, cardReference);
    const frozen = snapshot.rows.filter(r=>r.race_number===raceNumber).sort((a,b)=>a.predicted_rank-b.predicted_rank);
    const results = resultRows.filter(r=>r.raceNumber===raceNumber);
    const selection = effectiveTop4(frozen.map(r=>({horseNumber:r.horse_number,rank:r.predicted_rank,withdrawn:!!changeFor(r),announcedAtIso:changeFor(r)?.announcedAtIso})), snapshot.lockAt);
    const hasWithdrawal = frozen.some(r=>!!changeFor(r));
    const jockeyChanges = officialChanges.filter(c=>c.raceNumber===raceNumber && c.kind==='other' && /騎師|策騎/.test(c.text));
    const postLockJockeyChange = jockeyChanges.some(c=>c.announcedAtIso && Date.parse(c.announcedAtIso)>Date.parse(snapshot.lockAt));
    const unknownJockeyTiming = jockeyChanges.some(c=>!c.announcedAtIso);
    const actualTop4 = results.filter(r=>Number.isInteger(r.finishingPosition) && r.finishingPosition>0 && r.finishingPosition<99 && !withdrawn.has(`${raceNumber}:${r.horseNumber}`)).sort((a,b)=>a.finishingPosition-b.finishingPosition).slice(0,4).map(r=>r.horseNumber);
    const metricInput = { original: selection.original, actualTop4, status: changesAwareStatus(changesReadOk, unknownJockeyTiming ? 'unverified-change-timing' : selection.status), hasWithdrawal, postLockJockeyChange };
    return {
      raceNumber, raceId: info.raceId ?? `race_${date}_${snapshot.venue}_${raceNumber}`,startTime:info.startTime ?? null,title:info.title ?? null,class:info.class ?? null,distance:info.distance ?? null,going:info.going ?? null,track:info.track ?? null,course:info.course ?? null,
      metadataSource: resultInfo ? 'official-results-with-card-fallback' : 'current-official-card-display-only',
      scoreSource: frozen.some(r=>r.lgb_score != null) ? 'lgb' : 'elo', ensembleAlpha: config.alpha ?? null,
      predictedTop4: frozen.slice(0,4).map(r=>r.horse_number),
      // 原四揀不補位；鎖後退出馬只標無效（valid／withdrawn），鎖前未重算則不計分。
      effectiveTop4: selection,
      metricInput, officialMetric: officialRaceMetric(metricInput),
      changeClassification: { hasWithdrawal, postLockJockeyChange, unknownJockeyTiming, changesReadOk },
      picks: frozen.map(r=>({ horseId:r.horse_id,horseNumber:r.horse_number,nameCh:nameMap.get(r.horse_id)?.nameCh,nameEn:nameMap.get(r.horse_id)?.nameEn,draw:r.draw || null,rank:r.predicted_rank,finalScore:r.final_score,pWin:r.p_win,pTop3:r.p_top3,pTop4:null,horseElo:r.horse_elo,jockeyElo:r.jockey_elo,trainerElo:r.trainer_elo,eloComposite:r.elo_composite,factorBonus:r.factor_bonus,factorScores:r.factor_scores,scoreSource:r.score_source,lgbScore:r.lgb_score,generatedAt:r.generated_at,modelVersion:r.lgb_model_version,officialChange:(()=>{const c=changeFor(r);return c?{kind:c.kind,text:c.text,replacement:c.replacement,announcedAt:c.announcedAt,announcedAtIso:c.announcedAtIso,beforeLock:c.announcedAtIso?Date.parse(c.announcedAtIso)<Date.parse(snapshot.lockAt):null}:null;})() })),
      resultsStatus: results.length ? 'available' : 'pending', results,
      resultsEvidence: cloudResults.find(r=>r.raceNumber===raceNumber) ? {source:'lovable-cloud-official-archive',complete:true,sha256:cloudResults.find(r=>r.raceNumber===raceNumber)?.sha256,dividendsVerified:false} : {source:'legacy-results',complete:null,dividendsVerified:false},
    };
  });
  return { schemaVersion:1,date,venue:snapshot.venue,edition:'final' as const,frozen:true,source:'verified-original-snapshot',lockAt:snapshot.lockAt,generatedAt:snapshot.rows[0]?.generated_at,verifiedAt:new Date().toISOString(),snapshot:{sha256:original.sha256,capturedAt:original.captured_at,rows:snapshot.rows.length,races:races.length,captureTiming:Date.parse(original.captured_at)>Date.parse(snapshot.lockAt)?'after-lock':'at-or-before-lock'},probabilityEvidence:{pTop4:'not-saved-in-original'},identityEvidence:'current-card-cross-check-not-prelock-provenance',identityCheck,officialChanges:snap?{source:snap.source_url,sha256:snap.sha256,fetchedAt:snap.fetched_at,count:officialChanges.length,readOk:true}:changesReadOk?null:{readOk:false,count:null},resultsSource:'official-race-results',races };
}