import { createFileRoute } from "@tanstack/react-router";

import { AdminHead, DataTable, Panel, StatusBadge, useMemoCols } from "@/components/admin/kit";
import { useModelVersions, type VersionRow } from "@/components/admin/data";
import { LONG_FP, useFixture } from "@/components/admin/fixtures";

export const Route = createFileRoute("/_authenticated/admin/model-versions")({
  head: () => ({ meta: [{ title: "模型版本 · 天喜監控端" }, { name: "description", content: "天喜模型版本、凍結指紋及採用原因。" }, { property: "og:title", content: "模型版本 · 天喜監控端" }, { property: "og:description", content: "查看模型登記及完整版本說明。" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Versions,
});

const ENG: Record<string, string> = { racing: "賽馬" };

function Versions() {
  const mv = useModelVersions();
  const worst: VersionRow[] = [
    { version: "racing-stress", engine: "racing", fingerprint: LONG_FP, released_at: "2026-10-07", status: "active", notes: "超長說明".repeat(40) },
    { version: "x", engine: "racing", fingerprint: null, released_at: "2016-01-01", status: "archived", notes: null },
  ];
  const rows = useFixture<VersionRow[]>(mv.data ?? [], { demo: worst.slice(1), worst });
  const cols = useMemoCols<VersionRow>(() => [
    { accessorKey: "engine", header: "產品", cell: (c) => ENG[String(c.getValue())] ?? String(c.getValue()) },
    { accessorKey: "version", header: "版本", cell: (c) => <span className="font-mono-tx text-ink">{String(c.getValue())}</span> },
    { accessorKey: "status", header: "狀態", cell: (c) => <StatusBadge s={c.getValue() === "active" ? "ok" : "unknown"} label={c.getValue() === "active" ? "現行" : c.getValue() === "candidate" ? "候選" : "歸檔"} /> },
    { accessorKey: "released_at", header: "定版日（成績起計）", cell: (c) => <span className="tabnum font-mono-tx">{String(c.getValue())}</span> },
    { accessorKey: "fingerprint", header: "指紋", cell: (c) => <span className="font-mono-tx text-[10px]" title={String(c.getValue() ?? "")}>{String(c.getValue() ?? "—")}</span> },
    { accessorKey: "notes", header: "說明", cell: (c) => <span title={String(c.getValue() ?? "")}>{String(c.getValue() ?? "—")}</span> },
  ]);
  return (
    <>
      <AdminHead title="模型版本" en="Model versions" desc="香港賽馬所有登記版本，包括已歸檔版本。每個版本由定版日起獨立計成績，唔回填。前台只顯示現行版本。" onRefresh={() => mv.refetch()} refreshing={mv.isFetching} />
      <Panel title="版本登記表" en="model_versions">
        <div className="hidden md:block"><DataTable data={rows} columns={cols} empty={mv.isLoading ? "讀取中…" : "未有版本"} /></div>
        <div className="divide-y divide-hairline md:hidden">
          {rows.map((r) => (
            <article key={`${r.engine}-${r.version}`} className="min-w-0 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <b className="text-ink">{ENG[r.engine] ?? r.engine}</b>
                <StatusBadge s={r.status === "active" ? "ok" : "unknown"} label={r.status === "active" ? "現行" : r.status === "candidate" ? "候選" : "歸檔"} />
                <span className="ml-auto text-[10px] text-ink-3">{r.released_at}</span>
              </div>
              <p className="mt-2 break-words font-mono-tx text-[12px] text-ink [overflow-wrap:anywhere]">{r.version}</p>
              <p className="mt-1 break-words font-mono-tx text-[10px] text-ink-3 [overflow-wrap:anywhere]">指紋：{r.fingerprint ?? "—"}</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-ink-2 [overflow-wrap:anywhere]">{r.notes ?? "未有說明"}</p>
            </article>
          ))}
          {!rows.length ? <p className="py-4 text-center text-[12px] text-ink-3">{mv.isLoading ? "讀取中…" : "未有版本"}</p> : null}
        </div>
      </Panel>
    </>
  );
}
