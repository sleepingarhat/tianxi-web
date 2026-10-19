/** 合併同時讀取，但不保存已完成結果；每次重取都核對上游。 */
export function createPicksRefresh<T>(fetchLatest: () => Promise<T>) {
  let inflight: Promise<T> | null = null;
  return () => {
    if (!inflight) inflight = fetchLatest().finally(() => { inflight = null; });
    return inflight;
  };
}

/** 最終版必須由這份預測確認，另一次lock-state不能代證。 */
export function picksEdition(data: { frozen?: unknown; edition?: unknown } | null | undefined): "final" | "draft" | "unavailable" {
  if (!data || data.edition === "unavailable") return "unavailable";
  if (data.edition === "draft" || data.frozen === false) return "draft";
  return data.edition === "final" || data.frozen === true ? "final" : "draft";
}