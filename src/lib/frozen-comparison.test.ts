import {it,expect} from 'vitest';
import {frozenComparison} from './frozen-comparison';
it('有效3匹中2匹仍記2/4，總覽只計已核實場次',()=>{
  const r={raceNumber:1,picks:[1,2,3,4].map(horseNumber=>({horseNumber})),results:[1,2,5,6].map((horseNumber,i)=>({horseNumber,finishingPosition:i+1})),metricInput:{original:[1,2,3,4],actualTop4:[1,2,5,6],status:'valid',hasWithdrawal:true,postLockJockeyChange:false}};
  const x=frozenComparison({frozen:true,races:[r,{...r,raceNumber:2,metricInput:{...r.metricInput,status:'unverified'}}]});
  expect(x.summary?.racesEvaluated).toBe(1);expect(x.summary?.top4AvgIntersect).toBe(2);expect(x.races[1]?.top4IntersectCount).toBeNull();
});
it('讀取失敗不能冒充無預測',()=>{expect(()=>frozenComparison({frozen:false,races:[]})).toThrow();});