/** 讀取逾時訊號：舊瀏覽器冇 AbortSignal.timeout 時用 AbortController 補上，唔會因此拋錯。 */
export function timeoutSignal(ms: number): AbortSignal | null {
  try {
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      return AbortSignal.timeout(ms);
    }
    if (typeof AbortController === "undefined") return null;
    const controller = new AbortController();
    setTimeout(
      () => controller.abort(new DOMException("The operation timed out.", "TimeoutError")),
      ms,
    );
    return controller.signal;
  } catch {
    return null;
  }
}

/** 逾時（TimeoutError，或舊瀏覽器嘅 AbortError）。 */
export function isTimeoutError(error: unknown): boolean {
  const name = (error as { name?: unknown } | null)?.name;
  return name === "TimeoutError" || name === "AbortError";
}
