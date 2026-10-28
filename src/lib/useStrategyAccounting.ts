import { useQueries, useQuery } from "@tanstack/react-query";
import { useAuthState } from "./useAuthState";
import { useTier } from "./useTier";
import { txApi } from "./tx-api";
import { exoticPoolOptions } from "./racingPoolAccounting";
import { combineStrategyAccounting, CROSS_POOL_START, type StrategyPoint } from "./strategy-accounting";
export function useStrategyAccounting(days=90) {
  const tier=useTier(); const auth=useAuthState();
  const pnl=useQuery({queryKey:["strategyPnl",days],queryFn:()=>txApi.strategyPnl(`?days=${days}`),enabled:tier.has("pro"),staleTime:60_000});
  const base=pnl.data ?? {};
  const allPoints:StrategyPoint[]=Array.isArray(base.points)?base.points:[];
  const cutoff=new Date(Date.now()+8*3600e3-days*864e5).toISOString().slice(0,10);
  const rawPoints=allPoints.filter(p=>p.date>=cutoff);
  const queries=useQueries({queries:rawPoints.map(p=>({...exoticPoolOptions(p.date),enabled:tier.has("pro") && p.date>=CROSS_POOL_START,queryKey:["exotic-trio-verified-original",p.date,auth.userId ?? "guest"]}))});
  const combined=combineStrategyAccounting(rawPoints,queries.map(q=>q.data));
  const error=pnl.error ?? queries.find(q=>q.error)?.error;
  const loading=pnl.isPending || queries.some((q,i)=>String(rawPoints[i]?.date)>=CROSS_POOL_START && q.isPending);
  return {pnl,base,rawPoints,filtered:rawPoints.length<allPoints.length,...combined,error,loading,retry:()=>{void pnl.refetch();queries.forEach((q,i)=>{if(String(rawPoints[i]?.date)>=CROSS_POOL_START)void q.refetch();});}};
}