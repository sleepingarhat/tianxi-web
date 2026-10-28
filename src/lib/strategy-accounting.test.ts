import {describe,it,expect} from "vitest";
import {combineStrategyAccounting} from "./strategy-accounting";
describe("shared six-pool totals",()=>{
 it("includes double trio and triple trio costs and consolation payout",()=>{
  const p={name:"孖T",cost:90,payout:1000,consPayout:0,missing:false,mainHit:true};
  const r=combineStrategyAccounting([{date:"2026-10-25",cost:530,payout:100}], [{pools:[p,{...p,name:"三T",cost:270,payout:0,consPayout:50,mainHit:false}]}]);
  expect(r.totalCost).toBe(890);expect(r.totalPayout).toBe(1150);expect(r.totalNet).toBe(260);
 });
 it("does not count cross-race pools before 19 October or pending evidence",()=>{
  const p={name:"三T",cost:270,payout:1000,consPayout:0,missing:false,mainHit:true};
  const r=combineStrategyAccounting([{date:"2026-10-18",cost:530,payout:0},{date:"2026-10-19",cost:530,payout:0}],[{pools:[p]},{pools:[{...p,missing:true}]}]);
  expect(r.totalCost).toBe(1060);expect(r.totalPayout).toBe(0);expect(r.missing).toBe(1);
 });
});