import { beforeEach, describe, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({tier:vi.fn(),read:vi.fn(),fetch:vi.fn(),query:vi.fn()}));
vi.mock('@tanstack/react-router',()=>({createFileRoute:()=> (config:unknown)=>config}));
vi.mock('@tanstack/react-start',()=>({createServerFn:()=>{const b={inputValidator:()=>b,handler:(h:unknown)=>h};return b;}}));
vi.mock('@tanstack/react-start/server',()=>({setResponseHeader:vi.fn()}));
vi.mock('@/lib/picks-entitlement.server',()=>({viewerTier:m.tier}));
vi.mock('./picks-entitlement.server',()=>({viewerTier:m.tier}));
vi.mock('@/lib/frozen-racing.server',()=>({readFrozenRacing:m.read}));
vi.mock('@/lib/site-reader.server',()=>({WORKER_BASE:'https://worker.test',workerFetch:m.fetch}));
vi.mock('./public-racing-evidence.server',()=>({publicRacingQuery:m.query}));
import { Route as frozen } from '@/routes/api/public/frozen-racing';
import { Route as ledger } from '@/routes/api/public/freeze-ledger';
import { getPredictionReconciliation } from './racing-reconciliation.functions';
beforeEach(()=>{vi.resetAllMocks();m.tier.mockResolvedValue('guest');m.read.mockResolvedValue({races:[{raceNumber:1,picks:[8]},{raceNumber:2,picks:[13],actualTop4:[8,13,7,6]}]});m.fetch.mockResolvedValue(Response.json({meetings:[{races:[{raceNumber:2,predictedTop4:[8,13,6,2],actualTop4:[8,13,7,6]}]}]}));});
describe('直接公開接口與逐匹函數邊界',()=>{
  it('直接frozen-racing HTTP匿名只留第1場',async()=>{
    const r=await (frozen as any).server.handlers.GET({request:new Request('https://site.test/api/public/frozen-racing?date=2026-10-25')});
    expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toBe('private, no-store');
    const body=await r.json();expect(body.races[0].picks).toEqual([8]);expect(body.races[1]).not.toHaveProperty('picks');
  });
  it('對帳表不接受舊ETag回傳未投影共享快取',async()=>{
    const r=await (ledger as any).server.handlers.GET({request:new Request('https://site.test/api/public/freeze-ledger?dates=2026-10-25',{headers:{'If-None-Match':'old-full-body'}})});
    expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toBe('private, no-store');
    expect((await r.json()).meetings[0].races[0]).not.toHaveProperty('predictedTop4');
  });
  it.each(['registered','pro'])('%s經伺服器核實後HTTP取完整資料',async tier=>{
    m.tier.mockResolvedValue(tier);
    const r=await (frozen as any).server.handlers.GET({request:new Request('https://site.test/api/public/frozen-racing?date=2026-10-25')});
    expect((await r.json()).races[1].picks).toEqual([13]);
  });
  it('逐匹對帳guest R2分數移除但結果仍在',async()=>{
    m.query.mockResolvedValueOnce([{venue:'ST'}]).mockResolvedValueOnce([{count:1}]).mockResolvedValueOnce([{raceNumber:2,horseNumber:8,rank:1,score:99,finish:1,generatedAt:'2026-10-25T01:00:00Z'}]);
    const out=await (getPredictionReconciliation as any)({data:{date:'2026-10-25'}});
    expect(out.rows[0]).toMatchObject({rank:null,score:null,finish:1,redacted:true});
  });
});