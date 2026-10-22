// 天喜數據量：唯一來源＝生產 D1 實數（後端每日 06:00 HKT 以 COUNT(*) 重計並存表）。
// 經主站 /api/public/data-stats 代理讀取；讀唔到就顯示「—」或隱藏，絕不回落到寫死數字。
import { useQuery } from "@tanstack/react-query";

export type DataStatsCounts = {
  raceDays: number | null;
  races: number | null;
  runnerResults: number | null;
  horses: number | null;
  jockeys: number | null;
  trainers: number | null;
  formRecords: number | null;
  trackwork: number | null;
  sectionals: number | null;
  dividends: number | null;
  injuries: number | null;
  trialSessions: number | null;
  trialRunners: number | null;
  runningComments: number | null;
  oddsArchive: number | null;
  oddsLive: number | null;
};

export type DataStats = {
  schemaVersion: number;
  source: "d1";
  generatedAt: string;
  range: { first: string | null; last: string | null };
  counts: DataStatsCounts;
  latest: Record<string, string | null>;
  missing: string[];
};

export const DATA_STATS_URL = "/api/public/data-stats";
const DATA_STATS_TIMEOUT_MS = 10_000;

const isCount = (v: unknown) =>
  v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0);

/** Strict shape check: anything unexpected is treated as "no data" (→ 「—」), never guessed. */
export function parseDataStats(json: unknown): DataStats | null {
  if (!json || typeof json !== "object") return null;
  const d = json as Record<string, unknown>;
  if (d["ok"] === false || d["schemaVersion"] !== 1 || d["source"] !== "d1") return null;
  const counts = d["counts"] as Record<string, unknown> | undefined;
  if (!counts || typeof counts !== "object") return null;
  if (!Object.values(counts).every(isCount)) return null;
  const range = (d["range"] ?? {}) as Record<string, unknown>;
  return {
    schemaVersion: 1,
    source: "d1",
    generatedAt: typeof d["generatedAt"] === "string" ? d["generatedAt"] : "",
    range: {
      first: typeof range["first"] === "string" ? range["first"] : null,
      last: typeof range["last"] === "string" ? range["last"] : null,
    },
    counts: counts as unknown as DataStatsCounts,
    latest: (d["latest"] && typeof d["latest"] === "object" ? d["latest"] : {}) as Record<
      string,
      string | null
    >,
    missing: Array.isArray(d["missing"])
      ? (d["missing"] as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
  };
}

export async function fetchDataStats(): Promise<DataStats | null> {
  const res = await fetch(DATA_STATS_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(DATA_STATS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`數據量暫未能讀取（${res.status}）`);
  return parseDataStats(await res.json());
}

export function useDataStats() {
  return useQuery({
    queryKey: ["data-stats"],
    queryFn: fetchDataStats,
    staleTime: 3600_000,
    retry: 1,
  });
}

/** 113136 → "113,136"; unknown → "—". */
export function fmtCount(n: number | null | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n).toLocaleString("en-US") : "—";
}

/** 113136 → "11.3 萬"; < 10,000 → "9,590"; unknown → "—". */
export function fmtWan(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return n >= 10_000 ? `${(n / 10_000).toFixed(1)} 萬` : fmtCount(n);
}

/** One-line description for prose (manual etc.). Never emits a number it doesn't have. */
export function dataScaleSentence(d: DataStats | null | undefined): string {
  const c = d?.counts;
  if (!c || c.raceDays == null || c.races == null || c.runnerResults == null) {
    return "規模：以生產數據庫實數為準，每日自動更新（暫未能讀取即時數量）。";
  }
  return `規模：${fmtCount(c.raceDays)} 個賽馬日、${fmtCount(c.races)} 場賽事、${fmtCount(c.runnerResults)} 行出賽記錄（生產數據庫實數，每日自動更新${d?.range.last ? `；最新賽果 ${d.range.last}` : ""}）。`;
}
