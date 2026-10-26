import { describe, expect, it } from 'vitest';
import { isGuestVisibleRace, projectFreezeLedger, projectFrozenReconciliation, projectReconciliationRows } from './reconciliation-projection';
import { resultsAudit } from './results-audit';
import { frozenComparison } from './frozen-comparison';
import { officialRaceMetric, summarizeOfficialMetrics } from './racing-official-metrics';

const race = (raceNumber: number) => {
  const metricInput = { original: [8,13,6,2], actualTop4: [8,13,7,6], status: 'valid', hasWithdrawal: false, postLockJockeyChange: false };
  return { raceNumber, picks: metricInput.original.map((horseNumber, i) => ({ horseNumber, rank: i+1, finalScore: 99 })),
    predictedTop4: metricInput.original, actualTop4: metricInput.actualTop4, metricInput, officialMetric: officialRaceMetric(metricInput),
    results: metricInput.actualTop4.map((horseNumber,i) => ({ horseNumber, finishingPosition:i+1, hit:true, finalScore:99 })),
    effectiveTop4: { original: metricInput.original }, nestedNewPrivateField: { picks:[8,13,6,2] } };
};
const body = { frozen:true, date:'2026-10-25', venue:'ST', races:Array.from({length:11},(_,i)=>race(i+1)) };
describe('訪客只見第1場完整、其餘只見賽果', () => {
  it('11場保留、R1完整、R2–11白名單拒絕所有預測與新增私有欄位', () => {
    const out = projectFrozenReconciliation(body,'guest');
    expect(out.races).toHaveLength(11);
    expect(out.races[0]?.picks).toEqual(body.races[0]?.picks);
    for (const r of out.races.slice(1)) {
      expect(r).toMatchObject({redacted:true,actualTop4:[8,13,7,6]});
      for (const key of ['picks','predictedTop4','metricInput','officialMetric','effectiveTop4','nestedNewPrivateField']) expect(r).not.toHaveProperty(key);
      expect(r.results.every(x=>!('hit' in x) && !('finalScore' in x))).toBe(true);
    }
    expect(body.races[1]?.picks).toHaveLength(4);
  });
  it.each(['registered','pro'] as const)('%s保持完整11場', tier => {
    expect(projectFrozenReconciliation(body,tier)).toBe(body);
  });
  it('隱藏賽果可借同馬ID馬號名稱，但不借排名及分數', () => {
    const out=projectFrozenReconciliation({races:[{raceNumber:2,picks:[{horseId:'horse_K343',horseNumber:6,nameCh:'鋼星',rank:1,finalScore:99}],results:[{horseId:'horse_K343',horseNumber:6,finishingPosition:2}]}]},'guest');
    expect(out.races[0]?.results[0]).toEqual({horseId:'horse_K343',horseNumber:6,nameCh:'鋼星',finishingPosition:2});
  });
  it('隱藏十場不當零命中加入分母', () => {
    const projected = projectFrozenReconciliation(body,'guest');
    expect(resultsAudit(projected).summary).toMatchObject({races:1,originalAverage:3,excluded:0});
    expect(frozenComparison(projected).summary).toMatchObject({racesEvaluated:1,top4AvgIntersect:3});
  });
  it('對帳表R2保留實際頭四但移除命中、派彩與原四揀', () => {
    const out=projectFreezeLedger({meetings:[{date:body.date,races:[race(1),{...race(2),placeHits:3,flatWinPnl:10}]}]},'guest');
    const r=out.meetings?.[0]?.races[1];
    if (!r) throw new Error('missing race 2');
    expect(r.actualTop4).toEqual([8,13,7,6]);
    for(const key of ['picks','predictedTop4','placeHits','flatWinPnl']) expect(r).not.toHaveProperty(key);
  });
  it('原副本沒有actualTop4時仍由公開官方名次建立頭四', () => {
    const r=projectFrozenReconciliation({races:[{raceNumber:2,picks:[8,13,6,2],results:[{horseNumber:13,finishingPosition:2},{horseNumber:8,finishingPosition:1},{horseNumber:7,finishingPosition:3},{horseNumber:6,finishingPosition:4}]}]},'guest').races[0];
    expect(r).toHaveProperty('actualTop4',[8,13,7,6]);
  });
  it('逐匹對帳R2按馬號排序而非預測排名、原值與CSV資料同時移除', () => {
    const rows=[{raceNumber:2,horseNumber:13,rank:1,score:99,finish:2,horseElo:1600,secretNested:{picks:[13]}},{raceNumber:2,horseNumber:8,rank:2,score:90,finish:1}];
    const out=projectReconciliationRows(rows,'guest');
    expect(out.map(r=>r.horseNumber)).toEqual([8,13]);
    expect(out.every(r=>r.rank===null && r.score===null)).toBe(true);
    expect(out[0]).not.toHaveProperty('secretNested');
    expect(out.map(r=>r.finish)).toEqual([1,2]);
  });

  it('對帳表訪客唔見全日 meeting／season KPI，只由可見場重計', () => {
    const out = projectFreezeLedger({
      meetings: [{
        date: body.date, venue: 'ST', locked: true, source: 'prediction_log',
        racesEvaluated: 11, top4AvgIntersect: 1.909, top4CoveragePct: 47.7, top4FullHits: 0,
        top3AvgIntersect: 1.364, top3AnyHitPct: 81.8, placeHitPct: 40.9, winnerHitPct: 18.2,
        modelWinLogloss: 2.305, marketWinLogloss: 1.51, favouriteHitPct: 45.5, flatWinRoiPct: -59.1,
        races: [
          { raceNumber: 1, runners: 10, predictedTop4: [2,1,10,6], actualTop4: [6,8,1,9], top4Intersect: 2, top3Intersect: 1, top3AnyHit: true, placeSlots: 3, placeHits: 2, winnerHit: false, modelWinLogloss: 3.015, marketWinLogloss: 1.696, favouriteHit: false, flatWinPnl: -10 },
          { raceNumber: 2, runners: 14, predictedTop4: [1,2,3,4], actualTop4: [2,6,10,14], top4Intersect: 1, placeHits: 1, flatWinPnl: 20 },
        ],
      }],
      season: { meetings: 1, racesEvaluated: 11, top4AvgIntersect: 1.909, top4CoveragePct: 47.7, top4FullHits: 0, top3AvgIntersect: 1.364, top3AnyHitPct: 81.8, placeHitPct: 40.9, winnerHitPct: 18.2, modelWinLogloss: 2.305, marketWinLogloss: 1.51, favouriteHitPct: 45.5, flatWinRoiPct: -59.1 },
    }, 'guest');
    const m = out.meetings?.[0];
    expect(m?.racesEvaluated).toBe(1);
    expect(m?.top4AvgIntersect).toBe(2);
    expect(m?.top4CoveragePct).toBe(50);
    expect(m?.races[1]).toMatchObject({ redacted: true, actualTop4: [2,6,10,14] });
    expect(m?.races[1]).not.toHaveProperty('predictedTop4');
    expect(out.season).toMatchObject({ meetings: 1, racesEvaluated: 1, top4AvgIntersect: 2 });
    expect(out.season?.top4AvgIntersect).not.toBe(1.909);
  });
  it.each(['registered','pro'] as const)('對帳表 %s 保留全日 meeting KPI', tier => {
    const bodyIn = { meetings: [{ date: body.date, racesEvaluated: 11, top4AvgIntersect: 1.909, races: [race(1), race(2)] }], season: { meetings: 1, racesEvaluated: 11, top4AvgIntersect: 1.909 } };
    expect(projectFreezeLedger(bodyIn, tier)).toBe(bodyIn);
  });

  it('退出摘要訪客只計可見場，唔把隱藏場當全日分母', () => {
    const guest = summarizeOfficialMetrics(body.races.filter(r => isGuestVisibleRace(r.raceNumber)).map(r => r.metricInput));
    const full = summarizeOfficialMetrics(body.races.map(r => r.metricInput));
    expect(guest).toMatchObject({ races: 1, excluded: 0 });
    expect(full).toMatchObject({ races: 11, excluded: 0 });
    expect(guest.races).toBeLessThan(full.races);
  });
});