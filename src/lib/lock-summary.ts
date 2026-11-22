/**
 * 監控總覽「今日賽馬鎖定」顯示：Worker 喺無賽日回 { locked:false, source:'no-fixture' }，
 * 冇 date／lockAt。之前照樣顯示「未鎖」同「undefined · 0 行凍結」（2026-11-23 00:52 截圖）。
 */
export type LockStateLike = {
  locked?: boolean;
  date?: string | null;
  source?: string | null;
  frozenRows?: number | null;
  venue?: string | null;
  firstPostAt?: string | null;
  lockAt?: string | null;
} | null | undefined;

export function lockSummary(lock: LockStateLike) {
  if (!lock) return { value: "—", sub: "—", meeting: false, locked: false };
  const meeting = typeof lock.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(lock.date) && lock.source !== "no-fixture";
  if (!meeting) return { value: "今日無賽事", sub: "—", meeting: false, locked: false };
  const locked = lock.locked === true;
  return { value: locked ? "已鎖" : "未鎖", sub: `${lock.date} · ${lock.frozenRows ?? 0} 行凍結`, meeting: true, locked };
}
