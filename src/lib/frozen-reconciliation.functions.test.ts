import { beforeEach, describe, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({tier:vi.fn(),read:vi.fn(),fetch:vi.fn(),header:vi.fn()}));
vi.mock('@tanstack/react-start',()=>({createServerFn:()=>{const b={inputValidator:()=>b,handler:(h:unknown)=>h};return b;}}));
vi.mock('@tanstack/react-start/server',()=>({setResponseHeader:m.header}));
vi.mock('./picks-entitlement.server',()=>({viewerTier:m.tier}));
vi.mock('./frozen-racing.server',()=>({readFrozenRacing:m.read}));
vi.mock('./site-reader.server',()=>({WORKER_BASE:'https://worker.test',workerFetch:m.fetch}));
import { getViewerFrozenRacing, getViewerFreezeLedger } from './frozen-reconciliation.functions';
beforeEach(()=>{vi.resetAllMocks();m.tier.mockResolvedValue('guest');m.read.mockResolvedValue({races:[{raceNumber:1,picks:[1]},{raceNumber:2,picks:[2],actualTop4:[2,3,4,5]}]});});
describe('網站對帳讀取先驗會籍再回傳',()=>{
  it('guest直接函數讀取也沒有R2四揀',async()=>{
    const out=await (getViewerFrozenRacing as any)({data:{date:'2026-10-25'}});
    expect(out.races[1]).not.toHaveProperty('picks');
    expect(m.header).toHaveBeenCalledWith('Cache-Control','private, no-store');
  });
  it.each(['registered','pro'])('%s取完整凍結資料',async tier=>{
    m.tier.mockResolvedValue(tier);
    expect((await (getViewerFrozenRacing as any)({data:{date:'2026-10-25'}})).races[1].picks).toEqual([2]);
  });
  it('對帳表讀取共用workerFetch且訪客投影',async()=>{
    m.fetch.mockResolvedValue(Response.json({meetings:[{races:[{raceNumber:2,predictedTop4:[8,13,6,2],actualTop4:[8,13,7,6]}]}]}));
    const out=await (getViewerFreezeLedger as any)({});
    expect(m.fetch).toHaveBeenCalledWith('https://worker.test/api/analyze/freeze-ledger?since=2026-10-04',expect.objectContaining({cache:'no-store',signal:expect.any(AbortSignal)}));
    expect(out.meetings[0].races[0]).not.toHaveProperty('predictedTop4');
  });
});