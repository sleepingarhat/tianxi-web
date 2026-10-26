import { describe, expect, it } from 'vitest';
import { projectFreezeLedger, projectFrozenReconciliation, projectReconciliationRows } from './reconciliation-projection';
import { resultsAudit } from './results-audit';
import { frozenComparison } from './frozen-comparison';
import { officialRaceMetric } from './racing-official-metrics';

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
});