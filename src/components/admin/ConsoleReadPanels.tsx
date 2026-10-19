import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";

import { Card, Empty, ErrorNote, Loading, Pill, Scroller, Stat, StatGrid, Table, Td } from "@/components/tx/ui";
import { DOT, fmtTime, useAdminData } from "./console-data";

export function StatusPanel() {
  const status = useAdminData("/admin/api/status");
  const alerts = useAdminData("/admin/api/alerts");
  const gaps = useAdminData("/admin/api/gaps");
  const runs = useAdminData("/admin/api/runs?limit=15");

  const counts = status.data?.counts ?? {};
  const dates = status.data?.dates ?? {};

  const LABELS: [string, string][] = [
    ["meetings", "賽馬日"],
    ["races", "場次"],
    ["results", "賽果"],
    ["horses", "馬匹"],
    ["jockeys", "騎師"],
    ["trainers", "練馬師"],
    ["trackwork", "晨操"],
    ["injury", "傷患"],
    ["form", "往績"],
    ["entries", "排位表"],
    ["odds", "賠率"],
    ["horseElo", "馬 天喜ELO"],
    ["jockeyElo", "騎師 天喜ELO"],
    ["trainerElo", "練師 天喜ELO"],
  ];

  const alertList = (alerts.data?.alerts ?? []) as unknown[];
  const runList = (runs.data?.runs ?? []) as { conclusion?: string }[];
  const failed = runList.filter((r) => r.conclusion === "failure").length;
  const gapList = (gaps.data?.months ?? gaps.data?.gaps ?? []) as unknown[];

  return (
    <>
      <Card title="一屏總覽" en="Overview">
        <StatGrid cols={2}>
          <Stat label="引擎健康" value={alertList.length ? `${alertList.length} 項警報` : "正常"} sub="警報檢查" />
          <Stat label="數據完整性" value={gapList.length ? `${gapList.length} 個可疑月` : "齊全"} sub="賽馬日覆蓋" />
          <Stat label="同步狀態" value={runList.length ? `${runList.length - failed}/${runList.length} 成功` : "–"} sub={failed ? `失敗 ${failed}` : "最近工作流"} />
          <Stat label="最新賽果" value={String(dates.results ?? dates.meetings ?? "–")} sub="資料庫日期" />
        </StatGrid>
      </Card>
      <Card title="警報" en="Alerts" action={<button type="button" className="text-[11px] text-ink-3 underline" onClick={alerts.reload}>重新檢查</button>}>
        {alerts.loading && <Loading />}
        {alerts.error ? <ErrorNote error={alerts.error} /> : null}
        {alerts.data && (alerts.data.alerts?.length ? (
          <ul className="space-y-2">
            {alerts.data.alerts.map((a: any, i: number) => (
              <li key={i} className="flex gap-2 text-[12px] text-ink">
                <span className={`mt-[5px] h-2 w-2 shrink-0 rounded-full ${a.level === "red" ? "bg-lose" : "bg-gold-strong"}`} />
                {a.msg}
              </li>
            ))}
          </ul>
        ) : <Empty label="無警報" />)}
      </Card>

      <Card title="資料庫總量" en="Row Counts" action={<button type="button" className="text-[11px] text-ink-3 underline" onClick={status.reload}>刷新</button>}>
        {status.loading && <Loading />}
        {status.error ? <ErrorNote error={status.error} /> : null}
        {status.data && (
          <>
            <StatGrid cols={3}>
              {LABELS.map(([k, label]) => (
                <Stat key={k} label={label} value={<span className="tabnum">{(counts[k] ?? 0).toLocaleString()}</span>} />
              ))}
            </StatGrid>
            <div className="mt-3 space-y-1 text-[11px] text-ink-3">
              <div>最早賽馬日 <span className="tabnum text-ink">{dates.earliestMeeting ?? "—"}</span> · 最新 <span className="tabnum text-ink">{dates.latestMeeting ?? "—"}</span></div>
              <div>排位表 <span className="tabnum text-ink">{dates.latestEntry ?? "—"}</span> · 晨操 <span className="tabnum text-ink">{dates.latestTrackwork ?? "—"}</span></div>
              <div>天喜ELO <span className="tabnum text-ink">{dates.latestElo ?? "—"}</span> · 賠率 <span className="tabnum text-ink">{fmtTime(dates.latestOdds)}</span></div>
            </div>
          </>
        )}
      </Card>

      <Card title="可疑月份（賽馬日不足）" en="Suspect Months">
        {gaps.loading && <Loading />}
        {gaps.error ? <ErrorNote error={gaps.error} /> : null}
        {gaps.data && (gaps.data.suspectMonths?.length ? (
          <div className="flex flex-wrap gap-2">
            {gaps.data.suspectMonths.map((m: any) => (
              <Pill key={m.ym} tone="gold">{m.ym} · {m.n}</Pill>
            ))}
          </div>
        ) : <Empty label="無缺口" />)}
      </Card>

      <Card title="最近工作流" en="Workflow Runs" action={<button type="button" className="text-[11px] text-ink-3 underline" onClick={runs.reload}>刷新</button>}>
        {runs.loading && <Loading />}
        {runs.error ? <ErrorNote error={runs.error} /> : null}
        {runs.data && (runs.data.runs?.length ? (
          <Scroller>
            <Table head={["工作流", "狀態", "更新"]}>
              {runs.data.runs.map((r: any) => (
                <tr key={r.id}>
                  <Td>{r.name}</Td>
                  <Td>
                    <span className={r.conclusion === "failure" ? "text-lose" : r.conclusion === "success" ? "text-win" : "text-ink-3"}>
                      {r.conclusion || r.status}
                    </span>
                  </Td>
                  <Td mono>{fmtTime(r.updatedAt)}</Td>
                </tr>
              ))}
            </Table>
          </Scroller>
        ) : <Empty label="未取得 GitHub 工作流（Worker 未設 token）" />)}
      </Card>
    </>
  );
}

export function CoveragePanel() {
  const { data, error, loading, reload } = useAdminData("/admin/api/coverage");
  const meetings = useAdminData("/admin/api/meetings?limit=10");

  return (
    <>
      <Card title="14 個核心資料表" en="Datasets" action={<button type="button" className="text-[11px] text-ink-3 underline" onClick={reload}>刷新</button>}>
        {loading && <Loading />}
        {error ? <ErrorNote error={error} /> : null}
        {data && (
          <Scroller>
            <Table head={["資料", "歷史", "自動", "詳情", "最後成功"]}>
              {(data.datasets ?? []).map((d: any) => (
                <tr key={d.key}>
                  <Td>{d.label}</Td>
                  <Td><span className={`inline-block h-2 w-2 rounded-full ${DOT[d.history] ?? "bg-ink-3"}`} /></Td>
                  <Td><span className={`inline-block h-2 w-2 rounded-full ${DOT[d.auto] ?? "bg-ink-3"}`} /></Td>
                  <Td mono>{d.detail}</Td>
                  <Td mono>{fmtTime(d.lastSuccessAt)}</Td>
                </tr>
              ))}
            </Table>
          </Scroller>
        )}
      </Card>

      <Card title="引擎特徵健康" en="Factors">
        {data && (
          <Scroller>
            <Table head={["特徵", "權重", "歷史", "自動", "來源"]}>
              {(data.factors ?? []).map((f: any) => (
                <tr key={f.key}>
                  <Td>{f.label}</Td>
                  <Td mono>{f.weight ?? "—"}</Td>
                  <Td><span className={`inline-block h-2 w-2 rounded-full ${DOT[f.history] ?? "bg-ink-3"}`} /></Td>
                  <Td><span className={`inline-block h-2 w-2 rounded-full ${DOT[f.auto] ?? "bg-ink-3"}`} /></Td>
                  <Td mono>{f.sourceLabel}</Td>
                </tr>
              ))}
            </Table>
          </Scroller>
        )}
      </Card>

      <Card title="最近賽馬日" en="Meetings">
        {meetings.loading && <Loading />}
        {meetings.error ? <ErrorNote error={meetings.error} /> : null}
        {meetings.data && (
          <Scroller>
            <Table head={["日期", "馬場", "場地", "場次", "排位"]}>
              {(meetings.data.meetings ?? []).map((m: any) => (
                <tr key={m.id}>
                  <Td mono>{m.date}</Td>
                  <Td>{m.venue}</Td>
                  <Td>{m.track_condition ?? "—"}</Td>
                  <Td mono>{m.race_count}/{m.total_races ?? "—"}</Td>
                  <Td mono>{m.entry_count}</Td>
                </tr>
              ))}
            </Table>
          </Scroller>
        )}
      </Card>
    </>
  );
}

export function FeaturePanel() {
  const { data, error, loading, reload } = useAdminData("/admin/api/feature-audit");
  const lgb = useAdminData("/admin/api/lgb-predictions");

  const rows = useMemo(() => {
    if (!data) return [] as [string, any][];
    return Object.entries(data as Record<string, any>).filter(([, v]) => typeof v !== "object" || v === null);
  }, [data]);

  return (
    <>
      <Card title="特徵覆蓋審計" en="Feature Audit" action={<button type="button" className="text-[11px] text-ink-3 underline" onClick={reload}>刷新</button>}>
        {loading && <Loading />}
        {error ? <ErrorNote error={error} /> : null}
        {data && (
          <Scroller>
            <Table head={["指標", "值"]}>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <Td>{k}</Td>
                  <Td mono>{String(v)}</Td>
                </tr>
              ))}
            </Table>
          </Scroller>
        )}
        {data ? (
          <pre className="mt-3 max-h-64 overflow-auto rounded-[8px] bg-paper-3 p-2 text-[10px] leading-relaxed text-ink-2">
            {JSON.stringify(data, null, 2)}
          </pre>
        ) : null}
      </Card>

      <Card title="天喜LGB 預測儲存" en="天喜LGB Predictions">
        {lgb.loading && <Loading />}
        {lgb.error ? <ErrorNote error={lgb.error} /> : null}
        {lgb.data && (
          <>
            <StatGrid cols={2}>
              <Stat label="行數" value={<span className="tabnum">{lgb.data.summary?.rows_n ?? 0}</span>} />
              <Stat label="場次" value={<span className="tabnum">{lgb.data.summary?.races_n ?? 0}</span>} />
            </StatGrid>
            <div className="mt-2 text-[11px] text-ink-3">最新 <span className="tabnum text-ink">{fmtTime(lgb.data.summary?.latest)}</span></div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(lgb.data.byModelVersion ?? []).map((v: any) => (
                <Pill key={v.model_version}>{v.model_version} · {v.n}</Pill>
              ))}
            </div>
          </>
        )}
      </Card>
    </>
  );
}

