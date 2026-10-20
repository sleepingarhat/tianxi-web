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
    dispatch: async () => { dispatches++; return 21; }, run: async id => (runs ?? []).find(r=>r.id===id) ?? {id,created_at:'2026-10-20T12:20:00Z',status:'in_progress',conclusion:null}, unlocked: async () => true,
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
  it('GitHub失敗限次重試，達上限3次後停止並通知一次', async () => {
    const f=fixture(); f.setRuns([{id:21,created_at:'2026-10-20T12:20:00Z',status:'completed',conclusion:'failure'}]);
    let s=await advancePrelock('2026-10-21',{},f.deps);
    for(let n=0;n<6;n++) s=await advancePrelock('2026-10-21',s,f.deps);
    expect(f.counts().dispatches).toBe(3); expect(s.phase).toBe('card-failed');
    expect(s.cardFailureNotified).toBe(true);
    expect(f.messages.filter(m=>m.includes('重試上限')).length).toBe(1);
  });
  it('已有工作執行中不派送', async () => {
    const f=fixture(); f.setRuns([{id:1,created_at:'2026-10-20T12:10:00Z',status:'in_progress',conclusion:null}]);
    await advancePrelock('2026-10-21',{},f.deps); expect(f.counts().dispatches).toBe(0);
  });
  it('排隊超過20分鐘嘅卡死工作唔阻住新觸發', async () => {
    const f=fixture(); f.setRuns([{id:1,created_at:'2026-10-20T11:58:00Z',status:'queued',conclusion:null}]);
    const s=await advancePrelock('2026-10-21',{},f.deps); expect(f.counts().dispatches).toBe(1); expect(s.dispatchedRunId).toBe(21);
  });
});describe('觸發及通知失敗重試', () => {
  it('觸發失敗下一輪重新觸發，唔會永遠等', async () => {
    const f=fixture(); let ok=false; let n=0;
    f.deps.dispatch=async()=>{n++; return ok ? 21 : null;};
    let s=await advancePrelock('2026-10-21',{},f.deps); expect(s.phase).toBe('dispatch-failed');
    ok=true; s=await advancePrelock('2026-10-21',s,f.deps);
    expect(n).toBe(2); expect(s.phase).toBe('waiting-card');
  });
  it('通知發送失敗唔記為已通知，下一輪再發', async () => {
    const f=fixture(); let ok=false; let sent=0;
    f.deps.notify=async()=>{ if(ok) sent++; return ok; };
    let s=await advancePrelock('2026-10-21',{},f.deps); expect(s.warned).toEqual([]);
    ok=true; s=await advancePrelock('2026-10-21',s,f.deps);
    expect(sent).toBe(1); expect(s.warned).toEqual(['R1 #9 創科群英']);
  });
});
describe('排位工作只認自己 run id', () => {
  it('新更改即使舊讀取看似乾淨仍先更新排位，不能略過重算', async () => {
    const f=fixture(); f.setStale([]); f.deps.changeRevision='new-notice'; f.deps.pendingChanges=['換騎'];
    const s=await advancePrelock('2026-10-21',{},f.deps);
    expect(s.phase).toBe('waiting-card'); expect(f.counts()).toEqual({dispatches:1,freshReads:0});
  });
  it('完成自己的排位工作與新讀取才記錄重算時間', async () => {
    const f=fixture(); let s=await advancePrelock('2026-10-21',{},f.deps);
    expect(s.recomputedAt).toBeUndefined();
    f.setStale([]); f.setRuns([{id:21,created_at:'2026-10-20T12:20:00Z',status:'completed',conclusion:'success'}]);
    s=await advancePrelock('2026-10-21',s,f.deps);
    expect(s.recomputedAt).toBe('2026-10-20T12:19:00Z'); expect(s.phase).toBe('clean');
  });
  it('收到官方更改但預測逾時，仍啟動排位更新，唔當成功', async () => {
    const f = fixture(); f.setStale(null);
    f.deps.pendingChanges = ['R1 #9 創科群英 · 退出']; f.deps.changeRevision = 'notice-1';
    let s = await advancePrelock('2026-10-21', {}, f.deps);
    expect(s.phase).toBe('waiting-card'); expect(f.counts().dispatches).toBe(1);
    f.setRuns([{ id:21, created_at:'2026-10-20T12:20:00Z', status:'completed', conclusion:'success' }]);
    s = await advancePrelock('2026-10-21', s, f.deps);
    expect(s.phase).toBe('recompute-unreadable'); expect(s.recovered).toEqual([]);
  });
  it('同日新換騎公告會觸發新一輪，唔卡住舊已完成run', async () => {
    const f = fixture(); f.deps.changeRevision = 'jockey-change-2';
    const s = await advancePrelock('2026-10-21', { changeRevision:'notice-1', phase:'still-stale', requestedAt:'2026-10-20T10:00:00Z', dispatchedRunId:10 }, f.deps);
    expect(s.dispatchedRunId).toBe(21); expect(f.counts().dispatches).toBe(1);
  });
  it('鎖後即使有新公告或預測逾時都不重算', async () => {
    const f = fixture(); f.setStale(null); f.deps.unlocked = async () => false;
    f.deps.pendingChanges = ['換騎']; f.deps.changeRevision = 'new';
    const s = await advancePrelock('2026-10-21', {}, f.deps);
    expect(s.phase).toBe('lock-unknown-or-closed'); expect(f.counts()).toEqual({ dispatches:0, freshReads:0 });
  });
  it('同時段另一個成功 run 唔會被當成今次', async () => {
    const f=fixture(); let s=await advancePrelock('2026-10-21',{},f.deps);
    f.setRuns([{id:99,created_at:'2026-10-20T12:20:00Z',status:'completed',conclusion:'success'}]);
    s=await advancePrelock('2026-10-21',s,f.deps);
    expect(s.phase).toBe('waiting-card'); expect(f.counts().freshReads).toBe(0);
  });
  it('冇 run id 嘅舊狀態會重新觸發', async () => {
    const f=fixture(); const s=await advancePrelock('2026-10-21',{requestedAt:'2026-10-20T10:00:00Z',phase:'waiting-card'},f.deps);
    expect(s.dispatchedRunId).toBe(21); expect(f.counts().dispatches).toBe(1);
  });
});
