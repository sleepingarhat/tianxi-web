import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AdminHead, DataTable, Panel, StatusBadge, useMemoCols, type Status } from "@/components/admin/kit";
import { ago, useEngineHealth, useRacingHealth } from "@/components/admin/data";
import { adminGet } from "@/lib/admin.functions";
import { getOpsEventHistory } from "@/lib/ops-history.functions";
import { isArchivedProductEvent } from "@/lib/product-scope";
import { hkDateTime } from "@/lib/hkTime";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  head: () => ({ meta: [{ title: "日誌 · 天喜監控端" }, { name: "description", content: "日誌 · 天喜監控端：香港賽馬專用監控與唯讀對帳。" }, { property: "og:title", content: "日誌 · 天喜監控端" }, { property: "og:description", content: "日誌 · 天喜監控端：香港賽馬專用監控與唯讀對帳。" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Logs,
});

type Log = { kind: string; level: Status; source: string; message: string; at: string | null };

function Logs() {
  const get = useServerFn(adminGet);
  const getHistory = useServerFn(getOpsEventHistory);
  const alerts = useQuery({ queryKey: ["admin", "alerts"], queryFn: () => get({ data: { path: "/admin/api/alerts" } }) });
  const history = useQuery({ queryKey: ["admin", "ops-history"], queryFn: () => getHistory({ data: { days: 90, limit: 1000 } }) });
  const rh = useRacingHealth();
  const eh = useEngineHealth();

  const [showOk, setShowOk] = useState(false);
  const [lv, setLv] = useState<"all" | Status>("all");
  const [kw, setKw] = useState("");
  const logs: Log[] = [];
  // 訪客斷線（aborted）唔係錯誤，舊紀錄唔顯示。
  for (const event of (history.data ?? []).filter((e: { message: unknown }) => !/^(Error: aborted|AbortError)/.test(String(e.message)))) logs.push({
    kind: event.kind === "model_gate" ? "模型閘歷史" : "API 錯誤歷史",
    level: event.severity === "error" ? "fail" : event.severity === "warning" ? "warn" : "ok",
    source: String(event.source), message: String(event.message), at: event.occurred_at,
  });
  const a = alerts.data?.payload;
  const list: any[] = Array.isArray(a) ? a : a?.["alerts"] ?? a?.["items"] ?? [];
  for (const x of list) logs.push({ kind: "資料完整性", level: x.severity === "critical" || x.level === "error" ? "fail" : "warn", source: String(x.source ?? x.key ?? "後端"), message: String(x.message ?? x.title ?? JSON.stringify(x)).slice(0, 300), at: x.created_at ?? x.at ?? null });
  for (const w of rh.data?.workflows ?? []) if (w.state === "fail") logs.push({ kind: "定時任務失敗", level: "fail", source: `賽馬 · ${w.label}`, message: `${w.file} 結果 ${w.conclusion}`, at: w.startedAt });
  for (const t of rh.data?.telegram?.failing ?? []) logs.push({ kind: "告警", level: "warn", source: `Telegram · ${t.key}`, message: t.fail, at: t.sentAt });
  for (const c of (eh.data?.checks ?? []) as import('@/lib/racing-shapes').EngineCheck[]) if (String(c.status).toUpperCase() !== "PASS") logs.push({ kind: "模型閘", level: String(c.status).toUpperCase() === "FAIL" ? "fail" : "warn", source: String(c.label ?? c.key), message: String(c.note ?? c.detail ?? ""), at: null });
  for (const [n, q] of [["賽馬健康", rh], ["引擎健康", eh]] as const) if (q.isError) logs.push({ kind: "API 錯誤", level: "fail", source: n, message: String((q.error as Error)?.message ?? q.error), at: new Date().toISOString() });
  if (showOk) {
    for (const w of rh.data?.workflows ?? []) if (w.state !== "fail") logs.push({ kind: "定時任務成功", level: "ok", source: `賽馬 · ${w.label}`, message: `${w.file} 結果 ${w.conclusion ?? "—"}`, at: w.startedAt });
  }
  if (alerts.isError) logs.push({ kind: "API 錯誤", level: "fail", source: "/admin/api/alerts", message: String((alerts.error as Error)?.message ?? alerts.error), at: new Date().toISOString() });
  logs.sort((x, y) => (y.at ?? "").localeCompare(x.at ?? ""));
  const shown = logs.filter((l) => !isArchivedProductEvent(l.source, l.message) && (lv === "all" || l.level === lv) && (!kw || `${l.kind}${l.source}${l.message}`.toLowerCase().includes(kw.toLowerCase())));
  const cnt = (s: Status) => logs.filter((l) => l.level === s).length;

  const cols = useMemoCols<Log>(() => [
    { accessorKey: "at", header: "時間（香港）", cell: (c) => <span className="tabnum font-mono-tx">{c.getValue() ? `${hkDateTime(String(c.getValue()))} · ${ago(String(c.getValue()))}` : "—"}</span> },
    { accessorKey: "kind", header: "類別" },
    { accessorKey: "level", header: "級別", cell: (c) => <StatusBadge s={c.getValue() as Status} /> },
    { accessorKey: "source", header: "來源", cell: (c) => <span title={String(c.getValue())}>{String(c.getValue())}</span> },
    { accessorKey: "message", header: "內容", cell: (c) => <span title={String(c.getValue())}>{String(c.getValue())}</span> },
  ]);

  return (
    <>
      <AdminHead title="日誌" en="Logs" desc="持久 API 錯誤、定時任務失敗、資料完整性警告同模型閘歷史，集中一處。" onRefresh={() => { history.refetch(); alerts.refetch(); rh.refetch(); eh.refetch(); }} refreshing={alerts.isFetching || history.isFetching} />
      <Panel title="事件" en="Events">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {(["all", "fail", "warn", "ok"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setLv(k)} className={`rounded-[6px] border px-2 py-1 text-[11px] ${lv === k ? "border-gold text-gold" : "border-hairline text-ink-2"}`}>
              {{ all: `全部 ${logs.length}`, fail: `失敗 ${cnt("fail")}`, warn: `警告 ${cnt("warn")}`, ok: `正常 ${cnt("ok")}` }[k as string] ?? k}
            </button>
          ))}
          <label className="ml-1 flex items-center gap-1 text-[11px] text-ink-3"><input type="checkbox" checked={showOk} onChange={(e) => setShowOk(e.target.checked)} />包括成功任務</label>
          <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="搜尋來源／內容" className="ml-auto w-44 rounded-[6px] border border-hairline bg-paper-3 px-2 py-1 text-[11px] text-ink" />
        </div>
        <DataTable data={shown} columns={cols} pageSize={25} empty={alerts.isLoading || history.isLoading ? "讀取中…" : "冇異常紀錄"} />
      </Panel>
    </>
  );
}
