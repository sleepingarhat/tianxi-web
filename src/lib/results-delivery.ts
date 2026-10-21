export type ResultsDeliveryState = { runId?: number | undefined; dispatchedAt?: string | undefined; status?: string | undefined; conclusion?: string | null | undefined; verifiedAt?: string | undefined };

/** Completion requires the specific accepted run and every expected official race. */
export function resultsDeliveryVerified(state: ResultsDeliveryState, archived: number[], expected: number): boolean {
  if (!state.runId || state.status !== 'completed' || state.conclusion !== 'success' || !Number.isInteger(expected) || expected < 1) return false;
  const races = new Set(archived);
  return races.size === expected && Array.from({ length: expected }, (_, i) => i + 1).every(n => races.has(n));
}