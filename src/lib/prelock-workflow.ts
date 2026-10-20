/** Durable pre-lock workflow. Dispatch acceptance is not completion or permission to freeze. */
export type PrelockState = {
  warned?: string[] | undefined; recovered?: string[] | undefined; requestedAt?: string | undefined; runId?: number | undefined;
  phase?: string | undefined; dispatchedRunId?: number | undefined; checkedAt?: string | undefined; stale?: string[] | undefined; error?: string | undefined;
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
};

export async function advancePrelock(date: string, state: PrelockState, deps: PrelockDeps): Promise<PrelockState> {
  state = { ...state, warned: [...(state.warned ?? [])], recovered: [...(state.recovered ?? [])], checkedAt: deps.now() };
  const persist = async () => { await deps.save(state); };
  const alert = async (ids: string[]) => {
    const fresh = ids.filter(id => !state.warned?.includes(id));
    if (fresh.length && await deps.notify(`⚠️ 賽前更改：${date} ${fresh.join('、')}；未核實修復前不可凍結。更新及核對狀態會持續追蹤，同一匹退出馬不重複通知。`)) {
      state.warned = [...(state.warned ?? []), ...fresh]; await persist();
    }
  };
  if (!await deps.unlocked()) { state.phase = 'lock-unknown-or-closed'; await persist(); return state; }
  const before = await deps.read(false);
  if (before === null) { state.phase = 'picks-unreadable'; await alert(['預測讀取未能核實']); await persist(); return state; }
  state.stale = before;
  await alert(before);
  if (!before.length) {
    const recovered = (state.warned ?? []).filter(id => id !== '預測讀取未能核實' && !state.recovered?.includes(id));
    if (recovered.length) {
      // A cached clean body alone is not repair evidence. Require a completed card job and fresh read.
      // 只認今次觸發嗰個 run id，唔憑時間配對其他工作。
      const own = state.dispatchedRunId ? await deps.run(state.dispatchedRunId) : null;
      const completed = own && own.id === state.dispatchedRunId && own.status === 'completed' && own.conclusion === 'success' ? own : null;
      if (!completed || !await deps.unlocked() || (await deps.read(true))?.length !== 0) {
        state.phase = 'repair-not-verified'; await persist(); return state;
      }
      state.runId = completed.id;
      if (await deps.notify(`✅ 已核實修復：${date} ${recovered.join('、')}。GitHub 排位更新完成，重新計算已剔除退出馬；凍結仍須獨立來源及鎖點核對。`)) state.recovered = [...(state.recovered ?? []), ...recovered];
    }
    state.phase = 'clean'; await persist(); return state;
  }
  const runs = await deps.runs();
  if (!runs) { state.phase = 'github-status-unverified'; await persist(); return state; }
  if (runs.some(r => r.status !== 'completed')) { state.phase = 'waiting-card'; await persist(); return state; }
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
  if (completed.conclusion !== 'success') { state.phase = 'card-failed'; await persist(); return state; }
  // At most one recompute per successful card run, even if the same stale body persists.
  if (state.phase === 'still-stale' || state.phase === 'recompute-unreadable' || state.phase === 'recompute-intent') { await persist(); return state; }
  if (!await deps.unlocked()) { state.phase = 'lock-unknown-or-closed'; await persist(); return state; }
  state.phase = 'recompute-intent'; await persist();
  const after = await deps.read(true); state.stale = after ?? before;
  if (after === null) state.phase = 'recompute-unreadable';
  else if (after.length) state.phase = 'still-stale';
  else {
    state.phase = 'clean';
    const ids = (state.warned ?? []).filter(id => id !== '預測讀取未能核實' && !state.recovered?.includes(id));
    if (ids.length && await deps.notify(`✅ 已核實修復：${date} ${ids.join('、')}。GitHub 排位更新完成，重新計算已剔除退出馬；凍結仍須獨立來源及鎖點核對。`)) state.recovered = [...(state.recovered ?? []), ...ids];
  }
  await persist(); return state;
}