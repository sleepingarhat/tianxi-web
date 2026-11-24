import {it,expect} from 'vitest';
import {frozenComparison} from './frozen-comparison';
it('有效3匹中2匹仍記2/4，總覽只計已核實場次',()=>{
  const r={raceNumber:1,picks:[1,2,3,4].map(horseNumber=>({horseNumber})),results:[1,2,5,6].map((horseNumber,i)=>({horseNumber,finishingPosition:i+1})),metricInput:{original:[1,2,3,4],actualTop4:[1,2,5,6],status:'valid',hasWithdrawal:true,postLockJockeyChange:false}};
  const x=frozenComparison({frozen:true,races:[r,{...r,raceNumber:2,metricInput:{...r.metricInput,status:'unverified'}}]});
  expect(x.summary?.racesEvaluated).toBe(1);expect(x.summary?.top4AvgIntersect).toBe(2);expect(x.races[1]?.top4IntersectCount).toBeNull();
});
it('讀取失敗不能冒充無預測',()=>{expect(()=>frozenComparison({frozen:false,races:[]})).toThrow();});
it('平頭季軍兩匹都計入頭三，唔會當成未齊',()=>{
  const results=[{horseNumber:9,finishingPosition:1},{horseNumber:8,finishingPosition:2},{horseNumber:6,finishingPosition:3},{horseNumber:13,finishingPosition:3},{horseNumber:5,finishingPosition:5}];
  const r={raceNumber:7,picks:[13,8,5,14].map(horseNumber=>({horseNumber})),results,metricInput:{original:[13,8,5,14],actualTop4:[9,8,6,13],status:'valid',hasWithdrawal:false,postLockJockeyChange:false}};
  expect(frozenComparison({frozen:true,races:[r]}).races[0]?.top3IntersectCount).toBe(2);
});