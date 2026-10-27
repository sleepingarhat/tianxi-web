/** 清單揀選。空 id 代表未揀／不限，搜尋時仍釘在頂。 */

/**
 * 清單只喺未揀、輸入框有焦點、或搜尋字非空時打開。
 * 已揀而且搜尋清空、失焦（揀完會清空並 blur）就收起，避免手機鍵盤開住時成個表吊住。
 */
export function shouldShowOptionList(input: {
  selectedId: string;
  query: string;
  focused: boolean;
}): boolean {
  if (input.focused) return true;
  if (input.query.trim().length > 0) return true;
  if (!input.selectedId) return true;
  return false;
}

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
export function ensureListOption(
  options: readonly ListOption[],
  id: string,
  label?: string,
): ListOption[] {
  if (!id || options.some((o) => o.id === id)) return [...options];
  const extra: ListOption = label ? { id, label } : { id, label: id };
  return [...options, extra];
}
