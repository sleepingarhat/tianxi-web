import { createFileRoute, Link } from "@tanstack/react-router";

import { AdminHead, CountUp, Kpi, Panel, StatusBadge, type Status } from "@/components/admin/kit";
import { ago, useEngineHealth, useLockState, useModelVersions, useRacingHealth, useRollup } from "@/components/admin/data";
import { useCurrentOps } from "@/components/admin/useCurrentOps";
import { hkDateTime } from "@/lib/hkTime";

export const Route = createFileRoute("/_authenticated/admin/overview")({
  head: () => ({ meta: [{ title: "系統總覽 · 天喜監控端" }, { name: "description", content: "系統總覽 · 天喜監控端：香港賽馬專用監控與唯讀對帳。" }, { property: "og:title", content: "系統總覽 · 天喜監控端" }, { property: "og:description", content: "系統總覽 · 天喜監控端：香港賽馬專用監控與唯讀對帳。" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Overview,
});

function Overview() {
  const ops = useCurrentOps();
  const { eh, rh } = ops;
  const lock = useLockState();
  const roll = useRollup();
  const mv = useModelVersions();

  const wf = rh.data?.workflows ?? [];
  const wfFail = ops.logs.filter(log => log.level === "fail").length;
  const active = (mv.data ?? []).filter((v) => v.status === "active");

  const modules: { name: string; s: Status; detail: string; to: string }[] = [
    {
      name: "賽馬",
      s: eh.data?.overall === "PASS" && wfFail === 0 ? "ok" : eh.data?.overall === "FAIL" || wfFail > 1 ? "fail" : eh.isLoading ? "unknown" : "warn",
      detail: `引擎 ${eh.data?.overall ?? "—"} · 現時失敗 ${wfFail}`,
      to: "/admin/engine-health",
    },
  ];

  const refresh = () => { ops.refresh(); lock.refetch(); };

  return (
    <>
      <AdminHead title="系統總覽" en="Overview" desc="香港賽馬引擎、鎖定、派彩與定時任務狀態。" onRefresh={refresh} refreshing={ops.refreshing} updatedAt={eh.data?.generatedHKT ?? null} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="賽馬引擎守門" value={eh.data?.overall ?? "—"} tone={eh.data?.overall === "PASS" ? "win" : "gold"} sub={`${eh.data?.counts?.pass ?? "—"} 過 · ${eh.data?.counts?.watch ?? 0} 留意 · ${eh.data?.counts?.fail ?? 0} 失敗`} />
        <Kpi label="四揀平均中匹數（90 日）" value={<CountUp value={roll.data?.top4AvgIntersect} digits={2} />} tone="gold" sub={`${roll.data?.racesEvaluated ?? "—"} 場`} />
        <Kpi label="今日賽馬鎖定" value={lock.data?.locked ? "已鎖" : lock.data ? "未鎖" : "—"} tone={lock.data?.locked ? "win" : undefined} sub={lock.data ? `${lock.data.date} · ${lock.data.frozenRows ?? 0} 行凍結` : "—"} />
        <Kpi label="現時失敗" value={<CountUp value={wfFail} />} tone={wfFail ? "lose" : "win"} sub="與日誌共用核對範圍" />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {modules.map((m) => (
          <Link key={m.name} to={m.to} className="rounded-[12px] border border-hairline bg-paper-2 p-4 transition-colors hover:border-gold">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-bold text-ink">{m.name}</span>
              <span className="ml-auto"><StatusBadge s={m.s} /></span>
            </div>
            <p className="mt-2 truncate text-[11px] text-ink-3">{m.detail}</p>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Panel title="今日預測發布" en="Publish">
          <ul className="space-y-2 text-[12px]">
            <li className="flex gap-2"><span className="text-ink-3">賽馬</span><span className="ml-auto text-ink-2">{lock.data ? `${lock.data.venue ?? ""} 首場 ${hkDateTime(lock.data.firstPostAt)} · 鎖定 ${hkDateTime(lock.data.lockAt)}` : "今日無賽事"}</span></li>
          </ul>
        </Panel>
        <Panel title="現行模型版本" en="Active Versions" right={<Link to="/admin/model-versions" className="text-[10px] text-gold">全部</Link>}>
          <ul className="space-y-1.5">
            {active.map((v) => (
              <li key={v.version} className="flex min-w-0 items-center gap-2 text-[12px]">
                <span className="w-14 shrink-0 text-ink-3">{"賽馬"}</span>
                <span className="truncate font-mono-tx text-ink">{v.version}</span>
                <span className="tabnum ml-auto shrink-0 font-mono-tx text-[10px] text-ink-3">{v.released_at}</span>
              </li>
            ))}
            {!active.length ? <li className="text-[12px] text-ink-3">{mv.isLoading ? "讀取中…" : "未登記"}</li> : null}
          </ul>
        </Panel>
        <Panel title="API 健康" en="API Health">
          <ul className="space-y-1.5 text-[12px]">
            {[
              ["賽馬引擎健康", eh], ["賽馬後端定時任務", rh], ["賽馬鎖定狀態", lock],
            ].map(([n, q]: any) => (
              <li key={n} className="flex items-center gap-2">
                <span className="text-ink-2">{n}</span>
                <span className="ml-auto"><StatusBadge s={q.isError ? "fail" : q.isLoading ? "unknown" : "ok"} label={q.isError ? "失敗" : q.isLoading ? "讀取中" : "回應正常"} /></span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="資料管線" en="Pipelines" right={<Link to="/admin/data-freshness" className="text-[10px] text-gold">詳情</Link>}>
          <ul className="space-y-1.5 text-[12px]">
            <li className="flex gap-2"><span className="text-ink-3">最後派彩收料</span><span className="ml-auto text-ink-2">{rh.data?.lastDividend?.date ?? "—"}（{ago(rh.data?.lastDividend?.committedAt)}）</span></li>
            <li className="flex gap-2"><span className="text-ink-3">Telegram 告警</span><span className="ml-auto text-ink-2">{rh.data?.telegram?.detail ?? "—"}</span></li>

          </ul>
        </Panel>
      </div>
    </>
  );
}
