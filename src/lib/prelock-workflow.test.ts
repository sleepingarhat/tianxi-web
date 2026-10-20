import { describe, expect, it } from 'vitest';
import { advancePrelock, type PrelockDeps, type PrelockState, type CardRun } from './prelock-workflow';

function fixture() {
  let stale: string[] | null = ['R1 #9 創科群英'];
  let runs: CardRun[] | null = [];
  let dispatches = 0, freshReads = 0;
  const messages: string[] = [];
  let saved: PrelockState = {};
  const deps: PrelockDeps = {
    read: async fresh => { if (fresh) freshReads++; return stale; }, runs: async () => runs,
    dispatch: async () => { dispatches++; return true; }, unlocked: async () => true,
    notify: async m => { messages.push(m); return true; }, save: async s => { saved = structuredClone(s); },
    now: () => '2026-10-20T12:19:00Z',
  };
  return { deps, messages, setStale: (v: typeof stale) => { stale=v; }, setRuns: (v: typeof runs) => { runs=v; },
    counts: () => ({ dispatches, freshReads }), state: () => saved };
}
describe('退出警告與排位更新', () => {
  it('同一匹退出馬600輪只通知一次、派送一次，未完成不重算', async () => {
    const f=fixture(); let state: PrelockState={};
    for(let n=0;n<600;n++) state=await advancePrelock('2026-10-21',state,f.deps);
    expect(f.messages.length).toBe(1); expect(f.counts()).toEqual({dispatches:1,freshReads:0});
  });
  it('更新完成再重算，剔除後只發一次恢復', async () => {
    const f=fixture(); let s=await advancePrelock('2026-10-21',{},f.deps);
    f.setRuns([{id:21,created_at:'2026-10-20T12:20:00Z',status:'completed',conclusion:'success'}]);
    f.setStale([]); s=await advancePrelock('2026-10-21',s,f.deps); await advancePrelock('2026-10-21',s,f.deps);
    expect(f.messages.length).toBe(2); expect(f.counts().freshReads).toBe(1); expect(s.recovered).toEqual(['R1 #9 創科群英']);
  });
  it('已鎖定不派送、重算或通知', async () => {
    const f=fixture(); f.deps.unlocked=async()=>false;
    expect((await advancePrelock('2026-10-21',{},f.deps)).phase).toBe('lock-unknown-or-closed');
    expect(f.messages).toEqual([]); expect(f.counts()).toEqual({dispatches:0,freshReads:0});
  });
  it('讀取失敗不當修復成功', async () => {
    const f=fixture(); f.setStale(null); const s=await advancePrelock('2026-10-21',{},f.deps);
    expect(s.phase).toBe('picks-unreadable'); expect(s.recovered ?? []).toEqual([]);
  });
  it('GitHub失敗不重算或重複派送', async () => {
    const f=fixture(); const s=await advancePrelock('2026-10-21',{},f.deps);
    f.setRuns([{id:21,created_at:'2026-10-20T12:20:00Z',status:'completed',conclusion:'failure'}]);
    expect((await advancePrelock('2026-10-21',s,f.deps)).phase).toBe('card-failed');
    expect(f.counts()).toEqual({dispatches:1,freshReads:0});
  });
  it('已有工作執行中不派送', async () => {
    const f=fixture(); f.setRuns([{id:1,created_at:'2026-10-20T10:00:00Z',status:'in_progress',conclusion:null}]);
    await advancePrelock('2026-10-21',{},f.deps); expect(f.counts().dispatches).toBe(0);
  });
});