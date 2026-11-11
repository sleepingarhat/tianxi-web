import { createFileRoute } from "@tanstack/react-router";

import { AdminHead, DataTable, Kpi, NoteBox, Panel, StatusBadge, useMemoCols, type Status } from "@/components/admin/kit";
import { useEngineHealth, useModelVersions, useRollup } from "@/components/admin/data";

export const Route = createFileRoute("/_authenticated/admin/engine-health")({
  head: () => ({ meta: [{ title: "引擎健康 · 天喜監控端" }, { name: "description", content: "引擎健康 · 天喜監控端：香港賽馬專用監控與唯讀對帳。" }, { property: "og:title", content: "引擎健康 · 天喜監控端" }, { property: "og:description", content: "引擎健康 · 天喜監控端：香港賽馬專用監控與唯讀對帳。" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: EngineHealth,
});

type Check = { key: string; label: string; status: Status; detail: string };

function EngineHealth() {
  const eh = useEngineHealth();
  const roll = useRollup();
  const mv = useModelVersions();
  const d = eh.data ?? {};
  const raw: any[] = d.checks ?? d.gates ?? [];
  const checks: Check[] = raw.map((c: any, i: number) => ({
    key: String(c.key ?? c.id ?? i),
    label: String(c.label ?? c.name ?? c.key ?? `檢查 ${i + 1}`),
    status: (["PASS", "WATCH", "FAIL"].includes(String(c.status).toUpperCase()) ? String(c.status).toUpperCase() : "WATCH") as Status,
    detail: String(c.note ?? c.detail ?? c.message ?? ""),
  }));
  const cols = useMemoCols<Check>(() => [
    { accessorKey: "label", header: "檢查項" },
    { accessorKey: "status", header: "狀態", cell: (c) => <StatusBadge s={c.getValue() as Status} /> },
    { accessorKey: "detail", header: "說明", cell: (c) => <span title={String(c.getValue())}>{String(c.getValue()) || "—"}</span> },
  ]);
  const rc = (mv.data ?? []).find((v) => v.engine === "racing" && v.status === "active");

  return (
    <>
      <AdminHead title="引擎健康" en="Engine health" desc="香港賽馬 TX-Oracle 守門閘、現行版本與四揀指標。只讀，唔會改任何設定。" onRefresh={() => eh.refetch()} refreshing={eh.isFetching} updatedAt={d.generatedHKT} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="賽馬總閘" value={d.overall ?? "—"} tone={d.overall === "PASS" ? "win" : d.overall === "FAIL" ? "lose" : "gold"} sub={d.engine ?? ""} />
        <Kpi label="PASS / WATCH / FAIL" value={`${d.counts?.pass ?? 0} / ${d.counts?.watch ?? 0} / ${d.counts?.fail ?? 0}`} />
        <Kpi label="四揀平均（90 日）" value={roll.data?.top4AvgIntersect?.toFixed?.(2) ?? "—"} tone="gold" sub="目標 3.0 · 市場熱門 2.31" />
        <Kpi label="馬季" value={d.season?.label ?? "—"} sub={`下次 ${d.season?.nextMeeting ?? "—"}`} />
      </div>
      {d.summary ? <div className="mt-3"><NoteBox>{d.summary}</NoteBox></div> : null}
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Panel title="賽馬守門閘" en="Racing gates" className="lg:col-span-2">
          {checks.length ? <DataTable data={checks} columns={cols} searchable={false} pageSize={30} /> : <p className="text-[12px] text-ink-3">{eh.isLoading ? "讀取中…" : "後端未提供逐項檢查"}</p>}
        </Panel>
        <Panel title="版本指紋" en="Fingerprint">
          {[["賽馬", rc]].map(([n, v]: any) => (
            <div key={n} className="mb-3 min-w-0">
              <p className="text-[11px] text-ink-3">{n}</p>
              <p className="truncate font-mono-tx text-[13px] text-ink">{v?.version ?? "—"}</p>
              <p className="break-all font-mono-tx text-[10px] text-ink-3">{v?.fingerprint ?? "未有指紋"}</p>
              <p className="font-mono-tx text-[10px] text-ink-3">定版 {v?.released_at ?? "—"}</p>
            </div>
          ))}
          <p className="font-mono-tx text-[10px] text-ink-3">LGB：{d.constraintsLive?.objective ?? "—"} · leaves {d.constraintsLive?.numLeaves ?? "—"} · lr {d.constraintsLive?.learningRate ?? "—"}</p>
        </Panel>
      </div>

    </>
  );
}
