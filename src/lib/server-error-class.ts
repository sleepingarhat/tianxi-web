// 純函數錯誤分類：冇副作用，客戶端與伺服器端都可安全引入。
// 目的係將「其實唔係伺服器故障」嘅請求失敗同真正後端錯誤分開，
// 免得監控端「失敗」計數被客戶端版本過期或訪客斷線灌水。

// 瀏覽器分頁持有上一個版本打包嘅伺服器函數編號（正式站或預覽剛更新過就會出現），
// 該編號已唔喺當前 build，Start 編譯器會擲「Invalid server function ID」。
// 呢類屬客戶端版本過期，正確處理係請客戶端重新整理，唔當伺服器故障。
export function isStaleClientBuild(error: unknown): boolean {
  const text =
    error instanceof Error
      ? `${error.name}: ${error.message}\n${error.stack ?? ""}`
      : String(error ?? "");
  return /Invalid server function ID/i.test(text);
}

// 訪客中途關頁／斷線會造成 abort，唔係伺服器錯誤，唔入持久日誌。
export function isClientAbort(error: unknown, requestAborted?: boolean): boolean {
  if (requestAborted) return true;
  // 用空白分隔欄位，先至唔會將「aborted」＋「Error」連成一個字而漏走。
  const text = `${String((error as Error)?.message ?? error ?? "")} ${String((error as Error)?.name ?? "")}`;
  return /\baborted\b|AbortError/i.test(text);
}
