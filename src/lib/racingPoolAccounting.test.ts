import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
vi.mock('./official-favourites.functions', () => ({ getOfficialFavourites: vi.fn() }));
vi.mock('./hkjc-changes.functions', () => ({ getHkjcChanges: vi.fn() }));
import { calcPools, exoticPoolOptions } from './racingPoolAccounting';
import { getHkjcChanges } from './hkjc-changes.functions';

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe('跨場共用明細及無存證', () => {
  it('19/10起計前不讀凍結或派彩', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const options = exoticPoolOptions('2026-10-18');
    const run = options.queryFn;
    if (typeof run !== 'function') throw new Error('missing query');
    const result = await run({} as Parameters<typeof run>[0]);
    expect(result.pools).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('404核實失敗不能冒充無存證', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({reason:'verification-failed'},{status:404})));
    const run = exoticPoolOptions('2026-10-25').queryFn;
    if (typeof run !== 'function') throw new Error('missing query');
    await expect(run({} as Parameters<typeof run>[0])).rejects.toThrow('原始凍結未能核實');
  });
  it('三T只有安慰獎行，官方單T證明原票未中正獎，可自動結算270元成本', () => {
    const leg = (race:number) => ({race,bankers:[1,2],legs:[3,4,5],fifthFromLive:false as const});
    const [p] = calcPools([{race_no:7,pool:'三T(安慰獎)',combo:'3,6,10/1,4,9/任何組合',dividend:26624,unit:10}],{5:leg(5),6:leg(6),7:leg(7)}, {}, {}, {5:'3,6,10',6:'1,4,9',7:'2,10,11'});
    expect(p).toMatchObject({missing:false,pendingSettlement:false,cost:270,payout:0,consPayout:0});
    expect(p?.detail.map(d=>d.winningCombination)).toEqual(['3,6,10','1,4,9','2,10,11']);
  });
  it('原票可能中三T正獎但沒有官方金額，仍待核而非猜零', () => {
    const leg = (race:number) => ({race,bankers:[1,2],legs:[3,4,5],fifthFromLive:false as const});
    const [p] = calcPools([{race_no:3,pool:'三T(安慰獎)',combo:'1,2,3/1,2,3/F',dividend:50,unit:10}],{1:leg(1),2:leg(2),3:leg(3)}, {}, {}, {1:'1,2,3',2:'1,2,3',3:'1,2,3'});
    expect(p).toMatchObject({missing:true,pendingSettlement:true,payout:0,consPayout:0});
  });
  it('無存證不讀更改或派彩，不冒充讀取失敗', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ reason: 'no-archive' }, { status: 404 }));
    vi.stubGlobal('fetch', fetcher);
    const options = exoticPoolOptions('2026-10-19');
    const run = options.queryFn;
    if (typeof run !== 'function') throw new Error('missing query');
    const result = await run({} as Parameters<typeof run>[0]);
    expect(result.noArchive).toBe(true);
    expect(result.pools).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(getHkjcChanges).not.toHaveBeenCalled();
  });
  it('孖T兩場命中整口9注90元，派彩只計一次', () => {
    const leg = (race: number) => ({ race, bankers: [1, 2], legs: [3, 4, 5], fifthFromLive: false as const });
    const pools = calcPools([{ race_no: 2, pool: '孖T', combo: '1,2,3/1,2,4', dividend: 1000, unit: 10 }], { 1: leg(1), 2: leg(2) });
    expect(pools[0]).toMatchObject({ units: 9, cost: 90, payout: 1000, mainHit: true, mainDividend: 1000 });
    expect(pools[0]?.detail.map(d => d.hit)).toEqual([true, true]);
    expect(pools[0]?.detail[1]?.winningCombination).toBe('1,2,4');
  });
  it('官方任何組合段每張原票都派彩，不能命中卻計零元', () => {
    const leg = (race: number) => ({ race, bankers: [1, 2], legs: [3, 4, 5], fifthFromLive: false as const });
    const pools = calcPools([{ race_no: 3, pool: '第一口孖T', combo: '1,2,3/F', dividend: 13641, unit: 10 }], { 2: leg(2), 3: leg(3) });
    expect(pools[0]).toMatchObject({ mainHit: true, units: 9, cost: 90, payout: 40923 });
  });
  it('缺官方熱門的退出票不會成為已結算命中或派彩', () => {
    const leg = (race: number) => ({ race, bankers: [1, 2], legs: [3, 4, 5], fifthFromLive: false as const });
    const pools = calcPools([{ race_no: 2, pool: '孖T', combo: '1,2,3/1,2,4', dividend: 1000, unit: 10 }], { 1: leg(1), 2: leg(2) }, { 1: new Set([3]) });
    expect(pools[0]).toMatchObject({ missing: true, pendingWithdrawal: true, mainHit: false, payout: 0 });
  });
  it('逐張原票替補形成兩張相同中獎組合，兩張都派彩', () => {
    const leg = {race:1,bankers:[3,7],legs:[1,9,12],fifthFromLive:false as const};
    const other = {race:2,bankers:[1,2],legs:[3,4,5],fifthFromLive:false as const};
    const [p] = calcPools([{race_no:2,pool:'孖T',combo:'3,7,1/1,2,3',dividend:1000,unit:10}],{1:leg,2:other},{1:new Set([9])},{1:[3,1,6,2]});
    expect(p).toMatchObject({units:9,cost:90,payout:2000,missing:false});
    expect(leg.legs).toEqual([1,9,12]);
  });
  it('多行官方正獎逐行加總，保留仙位及不同結算場次', () => {
    const leg = (race:number) => ({race,bankers:[1,2],legs:[3,4,5],fifthFromLive:false as const});
    const rows = [{race_no:2,pool:'孖T',combo:'1,2,3/1,2,3',dividend:100.25,unit:10},{race_no:2,pool:'孖T',combo:'1,2,4/1,2,3',dividend:200.5,unit:10},{race_no:4,pool:'孖T',combo:'1,2,3/1,2,3',dividend:999,unit:10}];
    const pools = calcPools(rows,{1:leg(1),2:leg(2),3:leg(3),4:leg(4)});
    expect(pools).toHaveLength(2);
    expect(pools[0]?.payout).toBe(300.75);
    expect(pools[1]?.payout).toBe(999);
  });
  it('未知特殊組合可能命中時不能猜成未中或零派彩', () => {
    const leg = (race:number) => ({race,bankers:[1,2],legs:[3,4,5],fifthFromLive:false as const});
    const [p] = calcPools([{race_no:2,pool:'孖T',combo:'1,2,3/7>2,8,13',dividend:1000,unit:10}],{1:leg(1),2:leg(2)});
    expect(p).toMatchObject({missing:true,pendingSettlement:true,mainHit:false,payout:0});
  });
  it('另一段確定未中時無需猜特殊組合，整張原票確定未中', () => {
    const leg = (race:number) => ({race,bankers:[1,2],legs:[3,4,5],fifthFromLive:false as const});
    const [p] = calcPools([{race_no:2,pool:'孖T',combo:'6,7,8/7>2,8,13',dividend:1000,unit:10}],{1:leg(1),2:leg(2)});
    expect(p).toMatchObject({missing:false,mainHit:false,payout:0});
  });
  it('安慰獎不重複派給正獎票，只計餘下兩張', () => {
    const leg = (race:number) => ({race,bankers:[1,2],legs:[3,4,5],fifthFromLive:false as const});
    const [p] = calcPools([{race_no:2,pool:'孖T',combo:'1,2,3/1,2,3',dividend:1000,unit:10},{race_no:2,pool:'孖T(安慰獎)',combo:'1,2,3/F',dividend:50,unit:10}],{1:leg(1),2:leg(2)});
    expect(p).toMatchObject({payout:1000,consUnits:2,consPayout:100});
  });
});