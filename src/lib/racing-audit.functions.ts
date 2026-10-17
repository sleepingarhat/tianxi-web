import { cached, CACHE_TTL } from "./computed-cache.server";
// 公開只讀：重訓紀錄、值博長期走勢、完整性審計。固定查詢，唔改任何凍結數值。
import { createServerFn } from "@tanstack/react-start";

const D1 = "aad1636e-869a-43f5-aa95-4a19e3aa5517";
const GH = "https://api.github.com/repos/sleepingarhat/tianxi-racing/contents";

async function d1<T>(sql: string): Promise<T[]> {
  const token = process.env["CLOUDFLARE_API_TOKEN"], account = process.env["CLOUDFLARE_ACCOUNT_ID"];
  if (!token || !account) throw new Error("資料暫時未能讀取");
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${D1}/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql }), signal: AbortSignal.timeout(15_000),
  });
  const body = (await r.json()) as { success?: boolean; result?: { results?: T[] }[] };
  if (!r.ok || !body.success) throw new Error("資料暫時未能讀取");
  const rows = body.result?.[0]?.results;
  if (!Array.isArray(rows)) throw new Error("資料回應不完整");
  return rows;
}

async function ghJson<T>(path: string): Promise<T> {
  const token = process.env["GITHUB_TOKEN"];
  const r = await fetch(`${GH}/${path}`, {
    headers: { Accept: "application/vnd.github.raw+json", "User-Agent": "tianxi-web", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error("審計報告暫時未能讀取");
  return (await r.json()) as T;
}

export type RetrainManifest = {
  model_version: string; trained_on: string | null; training_start: string | null; training_end: string | null;
  training_rows: number | null; bundle_fingerprint: string | null; fitted_alpha: number | null; live_alpha: number | null;
  gate_status: string | null; runs: number; source: string;
};

/** 每個版本取最後一次成功重訓嘅實際輸出（同版本多次重訓會列 runs 數）。 */
export const getRetrainManifests = createServerFn({ method: "GET" }).handler(async (): Promise<RetrainManifest[]> => { return cached("retrain-manifests", CACHE_TTL, async () => {
  return d1<RetrainManifest>(`SELECT m.model_version, m.trained_on, m.training_start, m.training_end, m.training_rows,
      m.bundle_fingerprint, m.fitted_alpha, m.live_alpha, m.gate_status, m.source,
      (SELECT COUNT(*) FROM model_run_manifest x WHERE x.model_version = m.model_version) AS runs
    FROM model_run_manifest m
    WHERE m.recorded_at = (SELECT MAX(recorded_at) FROM model_run_manifest y WHERE y.model_version = m.model_version)
    ORDER BY m.model_version DESC LIMIT 100`);
});
});

export type ValueDay = {
  date: string; races: number; runners: number; pos_n: number; pos_wins: number;
  pos_exp_mk: number; pos_exp_model: number; pos_pnl: number; mad: number;
};

/** 凍結獨贏機率 vs 收市隱含機率（兩者每場歸一、去抽水）。研究口徑，非投注建議。 */
export const getValueTrend = createServerFn({ method: "GET" }).handler(async (): Promise<ValueDay[]> => { return cached("value-trend", CACHE_TTL, async () => {
  return d1<ValueDay>(`WITH b AS (SELECT date, race_number, p_win, actual_finish AS fin, actual_win_odds AS od, 1.0/actual_win_odds AS imp
      FROM prediction_log WHERE engine='v12' AND variant='baseline' AND predicted_rank IS NOT NULL
      AND actual_win_odds>1 AND actual_finish IS NOT NULL AND p_win IS NOT NULL),
    s AS (SELECT date, race_number, SUM(imp) AS tot, SUM(p_win) AS ps, COUNT(*) AS n FROM b GROUP BY date, race_number HAVING n>=5),
    x AS (SELECT b.*, b.imp/s.tot AS mk, b.p_win/s.ps AS pm FROM b JOIN s ON s.date=b.date AND s.race_number=b.race_number)
    SELECT date, COUNT(DISTINCT race_number) races, COUNT(*) runners,
      SUM(pm>mk) pos_n, SUM(CASE WHEN pm>mk AND fin=1 THEN 1 ELSE 0 END) pos_wins,
      ROUND(SUM(CASE WHEN pm>mk THEN mk ELSE 0 END),3) pos_exp_mk, ROUND(SUM(CASE WHEN pm>mk THEN pm ELSE 0 END),3) pos_exp_model,
      ROUND(SUM(CASE WHEN pm>mk THEN (CASE WHEN fin=1 THEN od*10 ELSE 0 END)-10 ELSE 0 END),1) pos_pnl,
      ROUND(AVG(ABS(pm-mk)),4) mad
    FROM x GROUP BY date ORDER BY date ASC LIMIT 400`);
});
});

type Cat = { name: string; expected: number; present: number; missing: string[]; stale: string[]; notes: string[]; severity: string };
type Integrity = { scan_date: string; overall_severity: string; critical_gap_count: number; warn_gap_count: number; recommendation: string; categories: Record<string, Cat> };
type Health = { generatedHKT: string; overall: string; counts: { pass: number; watch: number; fail: number }; checks: { id: string; label: string; status: string; detail: string }[] };

export type AuditDashboard = {
  integrity: { scanDate: string; status: string; critical: number; warn: number; recommendation: string;
    categories: { key: string; status: string; expected: number; present: number; missing: string[]; stale: number; note: string }[] } | null;
  history: { date: string; status: string; critical: number; warn: number }[];
  health: Health | null;
  retrain: RetrainManifest | null;
};

export const sev = (s: string) => (s === "ok" ? "PASS" : s === "warn" ? "WATCH" : s === "critical" ? "FAIL" : "WATCH");

export const getAuditDashboard = createServerFn({ method: "GET" }).handler(async (): Promise<AuditDashboard> => { return cached("audit-dashboard", CACHE_TTL, async () => {
  const [latest, list, health, retrain] = await Promise.all([
    ghJson<Integrity>("audit_reports/integrity_latest.json").catch(() => null),
    fetch(`${GH}/audit_reports`, { headers: { Accept: "application/vnd.github+json", "User-Agent": "tianxi-web", ...(process.env["GITHUB_TOKEN"] ? { Authorization: `Bearer ${process.env["GITHUB_TOKEN"]}` } : {}) }, signal: AbortSignal.timeout(10_000) })
      .then((r) => (r.ok ? (r.json() as Promise<{ name: string }[]>) : [])).catch(() => [] as { name: string }[]),
    ghJson<Health>("backend/reports/ENGINE_HEALTH.json").catch(() => null),
    getRetrainManifests().then((r) => r[0] ?? null).catch(() => null),
  ]);
  if (!latest || !health || !retrain || !list.length) throw new Error("完整性審計來源未能全部讀取；不以空結果覆蓋舊報告");
  if (!Array.isArray(list) || list.some(f => typeof f.name !== "string") || !latest.categories || typeof latest.categories !== "object" || !Array.isArray(health.checks) || !health.counts) throw new Error("審計資料格式未能核對");
  for (const category of Object.values(latest.categories)) {
    if (!Number.isFinite(category.expected) || !Number.isFinite(category.present) || !Array.isArray(category.missing) || !Array.isArray(category.stale) || !Array.isArray(category.notes)) throw new Error("審計分類資料不完整");
  }
  const days = list.map((f) => f.name.match(/^integrity_(\d{4}-\d{2}-\d{2})\.json$/)?.[1]).filter(Boolean).sort().slice(-14) as string[];
  if (!days.length) throw new Error("歷史審計列表未能核對");
  const history = (await Promise.all(days.map((d) => ghJson<Integrity>(`audit_reports/integrity_${d}.json`)
    .then((x) => ({ date: d, status: sev(x.overall_severity), critical: x.critical_gap_count, warn: x.warn_gap_count })).catch(() => null))))
    .filter(Boolean) as AuditDashboard["history"];
  if (history.length !== days.length) throw new Error("歷史審計未能完整讀取");
  return {
    integrity: latest ? {
      scanDate: latest.scan_date, status: sev(latest.overall_severity), critical: latest.critical_gap_count, warn: latest.warn_gap_count,
      recommendation: latest.recommendation,
      categories: Object.entries(latest.categories).map(([key, c]) => ({ key, status: sev(c.severity), expected: c.expected, present: c.present,
        missing: c.missing.slice(0, 8), stale: c.stale.length, note: c.notes.join("；") })),
    } : null,
    history, health: health ? { generatedHKT: health.generatedHKT, overall: health.overall, counts: health.counts, checks: health.checks } : null, retrain,
  };
});
});
