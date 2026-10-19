import { useServerFn } from "@tanstack/react-start";
import { useCallback, useState } from "react";

import { Card, Empty, ErrorNote, Loading, Pill, Scroller, Stat, StatGrid, Table, Td } from "@/components/tx/ui";
import { adminPost } from "@/lib/admin.functions";

import { useAdminData } from "./console-data";

const WORKFLOWS = [
  "capy_race_daily.yml",
  "capy_pool_a.yml",
  "capy_odds.yml",
  "capy_entries.yml",
  "capy_d1_sync.yml",
  "capy_d1_sync_entries.yml",
  "capy_d1_sync_pool_a.yml",
  "capy_d1_bulk_backfill.yml",
  "capy_fixture_weekly.yml",
  "capy_integrity_audit.yml",
  "capy_racecard.yml",
];

// 0 行但屬正常的表：舊版遺留、已被新表取代，或功能未啟用。
const TABLE_NOTES: Record<string, string> = {
  _horse_id_migration: "一次性馬匹編號搬遷用的臨時表，搬完已清空",
  trackwork: "舊晨操表，已被 horse_trackwork 取代",
  sync_state: "舊同步狀態表，現以 GitHub 工作流紀錄取代",
  ingestion_runs: "舊匯入紀錄表，已停用",
  jockey_season_records: "騎師季度統計表，暫由即時計算取代",
  barrier_trials: "閘門試閘舊表，已被 trial_sessions／trial_runners 流程取代",
  trial_sessions: "試閘場次表：新季試閘資料開鑼後才會有",
  trial_runners: "試閘馬匹表：新季試閘資料開鑼後才會有",
  users: "站內用戶已改用 Lovable 雲端帳戶，D1 不再存用戶",
  membership_sessions: "會員登入場次：會員功能未啟用",
  membership_entitlements: "會員權限：會員功能未啟用",
};


export function OpsPanel() {
  const post = useServerFn(adminPost);
  const tables = useAdminData("/admin/api/d1-maintenance");
  const [log, setLog] = useState<{ label: string; text: string; ok: boolean }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [wf, setWf] = useState(WORKFLOWS[0]);
  const [alpha, setAlpha] = useState("0.5");
  const [pruneDate, setPruneDate] = useState("");

  const run = useCallback(
    async (label: string, path: string, body?: unknown) => {
      setBusy(label);
      try {
        const r = await post({ data: { path, body } });
        setLog((prev) => [{ label, ok: r.ok, text: JSON.stringify(r.payload, null, 2) }, ...prev].slice(0, 12));
      } catch (e) {
        setLog((prev) => [{ label, ok: false, text: e instanceof Error ? e.message : String(e) }, ...prev].slice(0, 12));
      } finally {
        setBusy(null);
      }
    },
    [post],
  );

  const btn = "rounded-[8px] border border-hairline bg-paper-2 px-3 py-2 text-left text-[12px] text-ink disabled:opacity-50";

  return (
    <>
      <Card title="觸發工作流" en="Dispatch">
        <select
          value={wf}
          onChange={(e) => setWf(e.target.value)}
          className="w-full rounded-[8px] border border-hairline bg-paper-2 px-3 py-2 text-[12px] text-ink"
        >
          {WORKFLOWS.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run(`dispatch ${wf}`, "/admin/api/dispatch", { workflow: wf, ref: "main" })}
          className="mt-2 w-full rounded-[8px] bg-deep px-3 py-2 text-[12px] text-deep-fg disabled:opacity-50"
        >
          {busy?.startsWith("dispatch") ? "觸發中…" : "觸發"}
        </button>
      </Card>

      <Card title="引擎參數" en="Set Alpha">
        <div className="flex gap-2">
          <input
            value={alpha}
            onChange={(e) => setAlpha(e.target.value)}
            inputMode="decimal"
            className="tabnum w-24 rounded-[8px] border border-hairline bg-paper-2 px-3 py-2 text-[12px] text-ink"
          />
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run(`set-alpha ${alpha}`, `/admin/api/set-alpha?value=${encodeURIComponent(alpha)}`)}
            className={btn}
          >
            設定 alpha（0–1）
          </button>
        </div>
      </Card>

      <Card title="資料維護" en="Maintenance">
        <div className="grid gap-2">
          <button type="button" disabled={busy !== null} className={btn}
            onClick={() => run("prune-lgb", "/admin/api/d1-maintenance", { action: "prune-lgb-keep-latest-per-race" })}>
            清理 天喜LGB 舊版本（每場只留最新）
          </button>
          <div className="flex gap-2">
            <input
              value={pruneDate}
              onChange={(e) => setPruneDate(e.target.value)}
              placeholder="YYYY-MM-DD"
              className="tabnum w-32 rounded-[8px] border border-hairline bg-paper-2 px-3 py-2 text-[12px] text-ink"
            />
            <button type="button" disabled={busy !== null || !pruneDate} className={btn}
              onClick={() => run("prune-prediction-log", "/admin/api/d1-maintenance", { action: "prune-prediction-log-older-than", beforeDate: pruneDate })}>
              清理此日期前 prediction_log
            </button>
          </div>
          <button type="button" disabled={busy !== null || !pruneDate} className={btn}
            onClick={() => run("prune-elo", "/admin/api/d1-maintenance", { action: "prune-elo-snapshots-older-than", beforeDate: pruneDate })}>
            清理此日期前 天喜ELO snapshots
          </button>
          <button type="button" disabled={busy !== null} className={btn}
            onClick={() => run("housekeeping", "/admin/api/data-housekeeping", {})}>
            資料整理 data-housekeeping
          </button>
          <button type="button" disabled={busy !== null} className={btn}
            onClick={() => run("dedupe-meetings", "/admin/api/cleanup-duplicate-meetings", {})}>
            清理重複賽馬日
          </button>
          <button type="button" disabled={busy !== null} className={btn}
            onClick={() => run("refresh-dividends", "/admin/api/refresh-race-dividends", {})}>
            重整派彩 race dividends
          </button>
          <button type="button" disabled={busy !== null} className={btn}
            onClick={() => run("fix-pool-swap", "/admin/api/fix-dividend-pool-swap", {})}>
            修正派彩池錯位
          </button>
          <button type="button" disabled={busy !== null} className={btn}
            onClick={() => run("seed-jockey-elo", "/admin/api/seed-missing-jockey-elo", {})}>
            補種缺失騎師／練師 天喜ELO
          </button>
          <button type="button" disabled={busy !== null} className={btn}
            onClick={() => run("elo-backfill", "/admin/api/elo-backfill-from-results", {})}>
            由賽果回填 天喜ELO
          </button>
          <button type="button" disabled={busy !== null} className={btn}
            onClick={() => run("migrate-lgb", "/admin/api/migrate-prediction-log-lgb", {})}>
            Migration：prediction_log 天喜LGB 欄
          </button>
          <button type="button" disabled={busy !== null} className={btn}
            onClick={() => run("migrate-post-time", "/admin/api/migrate-entries-post-time", {})}>
            Migration：entries post_time
          </button>
        </div>
      </Card>

      <Card title="資料表行數" en="Table Counts" action={<button type="button" className="text-[11px] text-ink-3 underline" onClick={tables.reload}>刷新</button>}>
        {tables.loading && <Loading />}
        {tables.error ? <ErrorNote error={tables.error} /> : null}
        {tables.data && (() => {
          const all = Object.entries(tables.data.tableCounts ?? {}) as [string, number][];
          const live = all.filter(([t, n]) => n > 0 || !TABLE_NOTES[t]);
          const idle = all.filter(([t, n]) => n === 0 && TABLE_NOTES[t]);
          return (
            <>
              <Scroller>
                <Table head={["表", "行數"]}>
                  {live.map(([t, n]) => (
                    <tr key={t}>
                      <Td>{t}</Td>
                      <Td mono>{String(n)}</Td>
                    </tr>
                  ))}
                </Table>
              </Scroller>
              {idle.length > 0 && (
                <details className="mt-3 rounded-[8px] border border-hairline bg-paper-2 p-2.5">
                  <summary className="cursor-pointer text-[12px] text-ink-2">
                    0 行的表（{idle.length}）· 全部係舊表或備用表，非缺數據
                  </summary>
                  <div className="mt-2 divide-y divide-hairline">
                    {idle.map(([t]) => (
                      <div key={t} className="py-1.5">
                        <p className="tabnum font-mono-tx text-[11px] text-ink">{t}</p>
                        <p className="text-[11px] text-ink-3">{TABLE_NOTES[t]}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          );
        })()}
      </Card>


      <Card title="操作紀錄" en="Action Log">
        {log.length === 0 ? (
          <Empty label="尚未執行操作" />
        ) : (
          <div className="space-y-2">
            {log.map((l, i) => (
              <details key={i} className="rounded-[8px] border border-hairline bg-paper-2 p-2">
                <summary className={`cursor-pointer text-[12px] ${l.ok ? "text-win" : "text-lose"}`}>{l.label}</summary>
                <pre className="mt-2 max-h-48 overflow-auto text-[10px] text-ink-2">{l.text}</pre>
              </details>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

export function SqlPanel() {
  const post = useServerFn(adminPost);
  const [sql, setSql] = useState("SELECT date, venue, total_races FROM race_meetings ORDER BY date DESC LIMIT 20");
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      const r = await post({ data: { path: "/admin/api/sql-read", body: { sql } } });
      if (!r.ok) throw new Error(JSON.stringify(r.payload));
      setRows(((r.payload as { rows?: Record<string, unknown>[] } | null)?.rows) ?? []);
    } catch (e) {
      setErr(e);
      setRows(null);
    } finally {
      setBusy(false);
    }
  }

  const cols = rows && rows.length ? Object.keys(rows[0]) : [];

  return (
    <Card title="唯讀 SQL" en="SQL Read">
      <textarea
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        rows={4}
        className="w-full rounded-[8px] border border-hairline bg-paper-2 p-2 font-mono-tx text-[11px] text-ink"
      />
      <button type="button" disabled={busy} onClick={go} className="mt-2 w-full rounded-[8px] bg-deep px-3 py-2 text-[12px] text-deep-fg disabled:opacity-50">
        {busy ? "查詢中…" : "執行（只限 SELECT）"}
      </button>
      {err ? <ErrorNote error={err} /> : null}
      {rows && (rows.length ? (
        <Scroller>
          <Table head={cols}>
            {rows.map((r, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <Td key={c} mono>{r[c] === null ? "—" : String(r[c])}</Td>
                ))}
              </tr>
            ))}
          </Table>
        </Scroller>
      ) : <Empty label="無結果" />)}
    </Card>
  );
}
