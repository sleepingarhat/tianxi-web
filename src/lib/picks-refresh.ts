/** 合併同時讀取，但不保存已完成結果；每次重取都核對上游。 */
export function createPicksRefresh<T>(fetchLatest: () => Promise<T>, timeoutMs = 55_000) {
  let inflight: Promise<T> | null = null;
  return () => {
    if (!inflight) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("讀取預測逾時（timeout），請重新核對")), timeoutMs);
      });
      inflight = Promise.race([Promise.resolve().then(fetchLatest), deadline]).finally(() => {
        clearTimeout(timer);
        inflight = null;
      });
    }
    return inflight;
  };
}

/** 單次讀取失敗（逾時、網絡中斷、上游短暫5xx）先靜默重試一次，避免一次波動令已鎖定最終版整頁變成錯誤。
 *  只重新讀取同一份已核實副本，不改變凍結或核實規則。 */
export const PICKS_RETRY_DELAY_MS = 2_000;
export function shouldRetryPicks(failureCount: number): boolean {
  return failureCount < 1;
}

/** 最終版必須由這份預測確認，另一次lock-state不能代證。 */
export function assertPicksResponse(data: unknown): asserts data is import('./racing-shapes').DayPicks {
  if (!data || typeof data !== 'object' || !('races' in data) || !Array.isArray(data.races)) throw new Error('預測回應未完整，正在重新讀取');
  if (!data.races.length && !('noMeeting' in data && data.noMeeting === true) && !('edition' in data && data.edition === 'pending')) throw new Error('預測場次未完整，正在重新讀取');
}

export function picksEdition(data: { frozen?: unknown; edition?: unknown } | null | undefined): "final" | "draft" | "unavailable" {
  if (!data || data.edition === "unavailable" || data.edition === "pending") return "unavailable";
  if (data.edition === "draft" || data.frozen === false) return "draft";
  return data.edition === "final" || data.frozen === true ? "final" : "draft";
}

/** 背景重讀失敗時，只喺鎖點前保留上一份已讀初版；鎖後或初次失敗一律不可用。 */
export function editionAfterError(
  data: { frozen?: unknown; edition?: unknown; lockAt?: unknown } | null | undefined,
  hasError: boolean,
  now: number = Date.now(),
): "final" | "draft" | "unavailable" {
  if (!hasError) return picksEdition(data);
  if (picksEdition(data) !== "draft") return "unavailable";
  const lockAt = typeof data?.lockAt === "string" ? Date.parse(data.lockAt) : NaN;
  return Number.isFinite(lockAt) && now < lockAt ? "draft" : "unavailable";
}
