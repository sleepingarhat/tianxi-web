// 網站伺服器讀 Worker 嘅唯讀憑證。值只喺伺服器 process.env 讀；唔回傳、唔記錄、唔放 query string。
import { TX_BASE } from "./tx-api";

export const SITE_READER_HEADER = "X-Tianxi-Site-Token";
export const WORKER_BASE = TX_BASE;

export function siteReaderHeaders(): Record<string, string> {
  const token = (process.env["SITE_READER_TOKEN"] ?? "").trim();
  return token ? { [SITE_READER_HEADER]: token } : {};
}

function isWorkerUrl(url: string) {
  return url === WORKER_BASE || url.startsWith(`${WORKER_BASE}/`) || url.startsWith(`${WORKER_BASE}?`);
}

/** 只有 Worker 網址先附加唯讀憑證；GitHub 等其他網域一律原樣請求。保留 init（包括 timeout signal）。 */
export function workerFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (!isWorkerUrl(url)) return fetch(url, init);
  const headers = new Headers(init.headers);
  for (const [k, v] of Object.entries(siteReaderHeaders())) headers.set(k, v);
  return fetch(url, { ...init, headers });
}
