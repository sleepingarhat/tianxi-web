/** Durable pre-lock workflow. Dispatch acceptance is not completion or permission to freeze. */
export type PrelockState = {
  warned?: string[] | undefined; recovered?: string[] | undefined; requestedAt?: string | undefined; runId?: number | undefined;
  phase?: string | undefined; dispatchedRunId?: number | undefined; checkedAt?: string | undefined; stale?: string[] | undefined; error?: string | undefined; changeRevision?: string | undefined; recomputedAt?: string | undefined; generatedAt?: string | undefined; cardFailures?: number | undefined; cardFailureNotified?: boolean | undefined;
  /** 連續讀取失敗次數：單次瞬時故障唔告警，但仍即時 fail-closed。 */
  unreadableCount?: number | undefined;
};
export type CardRun = { id: number; created_at: string; status: string; conclusion: string | null };
export type PrelockDeps = {
  read: (fresh: boolean) => Promise<string[] | null>;
  runs: () => Promise<CardRun[] | null>;
  /** 回傳 GitHub 今次觸發嘅 run id；失敗或冇 id 回 null。 */
  dispatch: () => Promise<number | null>;
  run: (id: number) => Promise<CardRun | null>;
  unlocked: () => Promise<boolean>;
  notify: (message: string) => Promise<boolean>;
  save: (state: PrelockState) => Promise<void>;
  now: () => string;
  pendingChanges?: string[];
  changeRevision?: string;
};

export const STUCK_RUN_MS = 20 * 60_000;

export async function advancePrelock(date: string, state: PrelockState, deps: PrelockDeps): Promise<PrelockState> {
  state = { ...state, warned: [...(state.warned ?? [])], recovered: [...(state.recovered ?? [])], checkedAt: deps.now() };
  const newRevision = !!deps.changeRevision && state.changeRevision !== deps.changeRevision;
  if (newRevision) {
    state.changeRevision = deps.changeRevision;
    state.requestedAt = undefined; state.dispatchedRunId = undefined; state.runId = undefined; state.phase = undefined;
    state.recomputedAt = undefined; state.generatedAt = undefined;
    state.cardFailures = undefined; state.cardFailureNotified = undefined; state.unreadableCount = undefined;
  }
  const persist = async () => { await deps.save(state); };
  const alert = async (ids: string[]) => {
    const fresh = ids.filter(id => !state.warned?.includes(id));
    if (fresh.length && await deps.notify(`⚠️ 賽前更改：${date} ${fresh.join('、')}；未核實修復前不可凍結。更新及核對狀態會持續追蹤，同一匹退出馬不重複通知。`)) {
      state.warned = [...(state.warned ?? []), ...fresh]; await persist();
    }
  };
  if (!await deps.unlocked()) { state.phase = 'lock-unknown-or-closed'; await persist(); return state; }
  const current = await deps.read(false);
  const before = newRevision && deps.pendingChanges?.length ? deps.pendingChanges : current ?? deps.pendingChanges ?? [];
  if (current === null && !before.length) {
    state.phase = 'picks-unreadable';
    state.unreadableCount = (state.unreadableCount ?? 0) + 1;
    // 工作每分鐘運行：連續3次（約3分鐘）讀取失敗先告警，單次瞬時故障唔騷擾；由第一次失敗起已 fail-closed，唔會凍結。
    if (state.unreadableCount >= 3) await alert(['預測讀取未能核實']);
    await persist(); return state;
  }
  state.unreadableCount = undefined;
  state.stale = before;
  await alert(before);
  if (!before.length) {
    // 讀取失敗警告有專屬恢復通知：之前單次告警後就算讀取返正常都永遠唔報恢復，睇落似未解決。
    const readRecovered = (state.warned ?? []).includes('預測讀取未能核實') && !state.recovered?.includes('預測讀取未能核實');
    if (readRecovered && await deps.notify(`✅ 預測讀取已恢復：${date}。早前嘅讀取失敗屬暫時性；凍結仍須獨立來源及鎖點核對。`)) state.recovered = [...(state.recovered ?? []), '預測讀取未能核實'];
    const recovered = (state.warned ?? []).filter(id => id !== '預測讀取未能核實' && !state.recovered?.includes(id));
    if (recovered.length || (state.dispatchedRunId && !state.recomputedAt)) {
      // A cached clean body alone is not repair evidence. Require a completed card job and fresh read.
      // 只認今次觸發嗰個 run id，唔憑時間配對其他工作。
      const own = state.dispatchedRunId ? await deps.run(state.dispatchedRunId) : null;
      const completed = own && own.id === state.dispatchedRunId && own.status === 'completed' && own.conclusion === 'success' ? own : null;
      if (!completed || !await deps.unlocked() || (await deps.read(true))?.length !== 0) {
        state.phase = 'repair-not-verified'; await persist(); return state;
      }
      state.runId = completed.id;
      state.recomputedAt = deps.now();
      if (recovered.length && await deps.notify(`✅ 已核實修復：${date} ${recovered.join('、')}。GitHub 排位更新完成，重新計算已核對官方更改；凍結仍須獨立來源及鎖點核對。`)) state.recovered = [...(state.recovered ?? []), ...recovered];
    }
    state.phase = 'clean'; await persist(); return state;
  }
  const runs = await deps.runs();
  if (!runs) { state.phase = 'github-status-unverified'; await persist(); return state; }
  // 排隊／進行超過20分鐘嘅工作視為卡死（GitHub 可能取消唔到），唔再阻住新觸發；只認自己觸發嗰個編號。
  const nowMs = Date.parse(deps.now());
  if (runs.some(r => r.status !== 'completed' && r.id !== state.dispatchedRunId && nowMs - Date.parse(r.created_at) < STUCK_RUN_MS)) { state.phase = 'waiting-card'; await persist(); return state; }
  // 上次觸發失敗：清除請求時間，今輪重新觸發，唔好永遠等一個從未開始嘅工作。
  if (state.phase === 'dispatch-failed' || (state.requestedAt && !state.dispatchedRunId)) { state.requestedAt = undefined; state.dispatchedRunId = undefined; }
  if (!state.requestedAt) {
    if (!await deps.unlocked()) { state.phase = 'lock-unknown-or-closed'; await persist(); return state; }
    // Persist intent BEFORE the external write: interrupted dispatches must never be replayed blindly.
    state.requestedAt = deps.now(); state.phase = 'dispatch-intent'; await persist();
    const id = await deps.dispatch();
    if (id) { state.dispatchedRunId = id; state.phase = 'waiting-card'; } else state.phase = 'dispatch-failed';
    await persist(); return state;
  }
  const own = state.dispatchedRunId ? await deps.run(state.dispatchedRunId) : null;
  if (own === null) { state.phase = 'github-status-unverified'; await persist(); return state; }
  if (own.id !== state.dispatchedRunId || own.status !== 'completed') { state.phase = 'waiting-card'; await persist(); return state; }
  const completed = own;
  state.runId = completed.id;
  if (completed.conclusion !== 'success') {
    // 工作行完但失敗：限次重新觸發；達上限就停，唔會無限重複派送，鎖點前維持 fail-closed。
    state.cardFailures = (state.cardFailures ?? 0) + 1;
    state.phase = 'card-failed';
    if (state.cardFailures < 3) { state.requestedAt = undefined; state.dispatchedRunId = undefined; await persist(); return state; }
    if (!state.cardFailureNotified && await deps.notify(`❌ 排位更新工作失敗已達重試上限：${date}。未核實更新前唔會凍結，唔會冒稱已更新。`)) state.cardFailureNotified = true;
    await persist(); return state;
  }
  state.cardFailures = 0;
  // At most one recompute per successful card run, even if the same stale body persists.
  if (state.phase === 'still-stale' || state.phase === 'recompute-unreadable' || state.phase === 'recompute-intent') { await persist(); return state; }
  if (!await deps.unlocked()) { state.phase = 'lock-unknown-or-closed'; await persist(); return state; }
  state.phase = 'recompute-intent'; await persist();
  const after = await deps.read(true); state.stale = after ?? before;
  if (!await deps.unlocked()) { state.phase = 'lock-unknown-or-closed'; await persist(); return state; }
  if (after === null) state.phase = 'recompute-unreadable';
  else if (after.length) state.phase = 'still-stale';
  else {
    state.phase = 'clean';
    state.recomputedAt = deps.now();
    const ids = (state.warned ?? []).filter(id => id !== '預測讀取未能核實' && !state.recovered?.includes(id));
    if (ids.length && await deps.notify(`✅ 已核實修復：${date} ${ids.join('、')}。GitHub 排位更新完成，重新計算已剔除退出馬；凍結仍須獨立來源及鎖點核對。`)) state.recovered = [...(state.recovered ?? []), ...ids];
  }
  await persist(); return state;
}