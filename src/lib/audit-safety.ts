/** Fail closed on failed writes or mismatched evidence identities. */
export function assertDatabaseWrite(result: { error?: { message: string } | null }) {
  if (result.error) throw new Error(`資料寫入失敗：${result.error.message}`);
}
export function customerBelongsToUser(metadata: Record<string, string> | null | undefined, userId: string) {
  return metadata?.['userId'] === userId;
}
export function sameMeeting(date: string, venue: string, candidate: { date?: string | null | undefined; venue?: string | null | undefined } | null | undefined) {
  return Boolean(date && venue && candidate?.date === date && candidate?.venue === venue);
}
export function completeRaceIds(count: number, ids: string[]) {
  if (!Number.isInteger(count) || count < 0 || count > 20 || ids.length !== count || new Set(ids).size !== count) throw new Error("賽事場次列表不完整，停止輸出網站地圖。");
  return ids;
}
export function sameFourPicks(expected: number[], actual: number[]) {
  return expected.length === 4 && actual.length === 4 && new Set(expected).size === 4 && new Set(actual).size === 4 && expected.every(n => actual.includes(n));
}
