export const CROSS_POOL_START = "2026-10-19";
// 2026-11-25 起孖T／三T改用四揀複式：每場頭4選全拖，孖T 4×4＝16注×$10＝$160、三T 4×4×4＝64注×$10＝$640（用戶2026-11-25決定）。
// 之前賽日維持二拖三結算，歷史戰績不覆寫。
export const DT_FULL4_START = "2026-11-25";
export type StrategyPoint = { date: string; cost: number; payout: number; [key: string]: unknown };
type CrossPool = { name: string; cost: number; payout: number; consPayout: number; missing: boolean; mainHit: boolean };
export type CrossDay = { pools: CrossPool[]; noArchive?: boolean };
export function combineStrategyAccounting(points: StrategyPoint[], crossDays: (CrossDay | undefined)[]) {
  const cross = { DT: {cost:0,payout:0,net:0,wins:0,cons:0,bets:0}, TT: {cost:0,payout:0,net:0,wins:0,cons:0,bets:0} };
  let cumulative=0,missing=0,noArchive=0;
  const merged=points.map((point,index)=>{
    let cost=Number(point.cost),payout=Number(point.payout);
    if (!Number.isFinite(cost) || !Number.isFinite(payout)) throw new Error("單場彩池金額未能核實");
    const day=crossDays[index];
    if(point.date>=CROSS_POOL_START && day?.noArchive) noArchive++;
    for(const pool of point.date>=CROSS_POOL_START ? day?.pools ?? [] : []) {
      if(pool.missing){missing++;continue;}
      const key=/孖T/.test(pool.name)?"DT":/三T/.test(pool.name)?"TT":null;
      if(!key)continue;
      const ret=pool.payout+pool.consPayout;
      if (![pool.cost,ret].every(Number.isFinite)) throw new Error("跨場彩池金額未能核實");
      const b=cross[key]; b.cost+=pool.cost;b.payout+=ret;b.net+=ret-pool.cost;b.bets++;if(pool.mainHit)b.wins++;else if(pool.consPayout>0)b.cons++;
      cost+=pool.cost;payout+=ret;
    }
    cumulative+=payout-cost;
    return {...point,cost,payout,net:payout-cost,cum:cumulative};
  });
  const totalCost=merged.reduce((s,p)=>s+p.cost,0),totalPayout=merged.reduce((s,p)=>s+p.payout,0);
  return {points:merged,cross,missing,noArchive,totalCost,totalPayout,totalNet:totalPayout-totalCost,roiPct:totalCost?(totalPayout/totalCost-1)*100:null};
}