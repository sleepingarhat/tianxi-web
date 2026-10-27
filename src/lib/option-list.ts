/** 清單揀選（場地天氣／頭對頭共用）。空 id 代表「不限」，搜尋時仍釘在頂。 */

export type ListOption = {
  id: string;
  label: string;
  hint?: string;
};

export function filterListOptions(options: readonly ListOption[], query: string): ListOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...options];
  const pinned = options.filter((o) => o.id === "");
  const rest = options.filter((o) => {
    if (o.id === "") return false;
    return `${o.label} ${o.hint ?? ""} ${o.id}`.toLowerCase().includes(q);
  });
  return [...pinned, ...rest];
}

/** 深連結嘅舊值唔喺目錄時仍可顯示，避免揀選狀態消失。 */
export function ensureListOption(options: readonly ListOption[], id: string, label?: string): ListOption[] {
  if (!id || options.some((o) => o.id === id)) return [...options];
  const extra: ListOption = label ? { id, label } : { id, label: id };
  return [...options, extra];
}
