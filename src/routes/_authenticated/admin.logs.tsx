import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AdminHead, DataTable, Panel, StatusBadge, useMemoCols, type Status } from "@/components/admin/kit";
import { ago } from "@/components/admin/data";
import { useCurrentOps } from "@/components/admin/useCurrentOps";
import { Button } from "@/components/ui/button";
import type { OpsLog } from "@/lib/ops-log-projection";
import { hkDateTime } from "@/lib/hkTime";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  head: () => ({ meta: [{ title: "日誌 · 天喜監控端" }, { name: "description", content: "日誌 · 天喜監控端：香港賽馬專用監控與唯讀對帳。" }, { property: "og:title", content: "日誌 · 天喜監控端" }, { property: "og:description", content: "日誌 · 天喜監控端：香港賽馬專用監控與唯讀對帳。" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Logs,
});

type Log = OpsLog;

function Logs() {
  const [showOk, setShowOk] = useState(false);
  const [lv, setLv] = useState<"all" | Status>("all");
  const [kw, setKw] = useState("");
  const ops = useCurrentOps(showOk);
  const current = ops.logs.filter(l => !kw || `${l.kind}${l.source}${l.message}`.toLowerCase().includes(kw.toLowerCase()));
  const shown = current.filter((l) => lv === "all" || l.level === lv);
  const cnt = (s: Status) => current.filter((l) => l.level === s).length;

  const cols = useMemoCols<Log>(() => [
    { accessorKey: "at", header: "時間（香港）", cell: (c) => <span className="tabnum font-mono-tx">{c.getValue() ? `${hkDateTime(String(c.getValue()))} · ${ago(String(c.getValue()))}` : "—"}</span> },
    { accessorKey: "kind", header: "類別" },
    { accessorKey: "level", header: "級別", cell: (c) => <StatusBadge s={c.getValue() as Status} /> },
    { accessorKey: "source", header: "來源", cell: (c) => <span title={String(c.getValue())}>{String(c.getValue())}</span> },
    { accessorKey: "message", header: "內容", cell: (c) => <span title={String(c.getValue())}>{String(c.getValue())}</span> },
  ]);

  return (
    <>
      <AdminHead title="日誌" en="Logs" desc="現時異常及今日事件" onRefresh={ops.refresh} refreshing={ops.refreshing} />
      <Panel title="事件" en="Events">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {(["all", "fail", "warn", "ok"] as const).map((k) => (
            <Button key={k} type="button" variant="outline" size="sm" onClick={() => setLv(k)} className={`rounded-[6px] bg-paper-3 px-2 text-[11px] hover:bg-paper-3 ${lv === k ? "border-gold text-gold" : "border-hairline text-ink-2"}`}>
              {{ all: `全部 ${current.length}`, fail: `失敗 ${cnt("fail")}`, warn: `警告 ${cnt("warn")}`, ok: `正常 ${cnt("ok")}` }[k as string] ?? k}
            </Button>
          ))}
          <label className="ml-1 flex items-center gap-1 text-[11px] text-ink-3"><input type="checkbox" checked={showOk} onChange={(e) => setShowOk(e.target.checked)} />包括成功任務</label>
          <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="搜尋來源／內容" className="ml-auto w-44 rounded-[6px] border border-hairline bg-paper-3 px-2 py-1 text-[11px] text-ink" />
        </div>
        {shown.length === 0 ? (
          <p className="py-5 text-center text-[11px] text-ink-3">{ops.loading ? "讀取中…" : "冇異常紀錄"}</p>
        ) : (
          <>
            {/* 手機：逐條堆疊，時間同級別照顯示，舊事故唔會睇落似即時失敗。 */}
            <ul data-testid="log-cards" className="space-y-2 md:hidden">
              {shown.slice(0, 30).map((l, i) => (
                <li key={`${l.at ?? ""}-${i}`} className="rounded-[8px] border border-hairline bg-paper-3 px-2.5 py-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge s={l.level} />
                    <span className="tabnum font-mono-tx text-[10px] text-ink-3">{l.at ? `${hkDateTime(String(l.at))} · ${ago(String(l.at))}` : "—"}</span>
                  </div>
                  <p className="mt-1 break-words text-[12px] font-bold text-ink">{l.source}</p>
                  <p className="mt-0.5 break-words text-[11px] leading-relaxed text-ink-2">{l.message}</p>
                </li>
              ))}
            </ul>
            {shown.length > 30 ? <p className="mt-2 text-[10px] leading-relaxed text-ink-3">手機只列最近30條；全部 {shown.length} 條請用電腦版表格。</p> : null}
            <div className="hidden md:block">
              <DataTable data={shown} columns={cols} pageSize={25} />
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
