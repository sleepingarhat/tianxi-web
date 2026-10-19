// 歷史讀取上限：截斷必須標示，唔可以靜靜雞由最舊（或最新）剪走。
// 上限一律保留「最新」嘅 limit 筆；截斷就回 truncated=true 由 UI 顯示提示。
export type TruncatedList<T> = { items: T[]; truncated: boolean };

export function truncateRecent<T>(rows: T[], limit: number, key: (row: T) => string): TruncatedList<T> {
  const sorted = [...rows].sort((a, b) => {
    const ka = key(a), kb = key(b);
    return ka < kb ? 1 : ka > kb ? -1 : 0; // 最新在前
  });
  const truncated = sorted.length > limit;
  return { items: truncated ? sorted.slice(0, limit) : sorted, truncated };
}
