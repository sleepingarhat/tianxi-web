import { createFileRoute } from "@tanstack/react-router";

import { AdminHead, DataTable, Panel, StatusBadge, useMemoCols, type Status } from "@/components/admin/kit";
import { ago, useRacingHealth } from "@/components/admin/data";
import { useFixture, workflowFixture } from "@/components/admin/fixtures";
import { hkDateTime } from "@/lib/hkTime";

export const Route = createFileRoute("/_authenticated/admin/data-freshness")({
  head: () => ({ meta: [{ title: "資料新鮮度 · 天喜監控端" }, { name: "description", content: "資料新鮮度 · 天喜監控端：香港賽馬專用監控與唯讀對帳。" }, { property: "og:title", content: "資料新鮮度 · 天喜監控端" }, { property: "og:description", content: "資料新鮮度 · 天喜監控端：香港賽馬專用監控與唯讀對帳。" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Freshness,
});

type Row = { product: string; label: string; state: Status; conclusion: string; at: string | null };

function Freshness() {
  const rh = useRacingHealth();

  const realWf = rh.data?.workflows ?? [];
  const wf = useFixture<any[]>(realWf, { demo: workflowFixture("demo"), worst: workflowFixture("worst") });
  const rows: Row[] = [
    ...wf.map((w) => ({
      product: "賽馬",
      label: w.label,
      state: (w.state === "ok" ? "ok" : w.state === "fail" ? "fail" : w.startedAt ? "stale" : "missing") as Status,
      conclusion: w.conclusion ?? w.status ?? "—",
      at: w.startedAt,
    })),

  ];
  const cols = useMemoCols<Row>(() => [
    { accessorKey: "product", header: "產品" },
    { accessorKey: "label", header: "任務", cell: (c) => <span title={String(c.getValue())}>{String(c.getValue())}</span> },
    { accessorKey: "state", header: "狀態", cell: (c) => <StatusBadge s={c.getValue() as Status} /> },
    { accessorKey: "conclusion", header: "結果" },
    { accessorKey: "at", header: "最後運行（香港時間）", cell: (c) => <span className="tabnum font-mono-tx">{c.getValue() ? `${hkDateTime(String(c.getValue()))} · ${ago(String(c.getValue()))}` : "從未運行"}</span> },
  ]);

  return (
    <>
      <AdminHead title="資料新鮮度" en="Data Freshness" desc="香港賽馬資料最後更新時間同 GitHub 定時任務狀態；過時、缺失、失敗會標出。" onRefresh={() => { rh.refetch();  }} refreshing={rh.isFetching} />
      <div className="grid gap-3 md:grid-cols-1">
        <Panel title="賽馬派彩" en="Racing">
          <p className="font-mono-tx text-[16px] text-ink">{rh.data?.lastDividend?.date ?? "—"}</p>
          <p className="text-[11px] text-ink-3">寫入 {ago(rh.data?.lastDividend?.committedAt)}</p>
        </Panel>

      </div>
      <Panel title="定時任務" en="GitHub Actions" className="mt-4">
        <DataTable data={rows} columns={cols} pageSize={25} empty={rh.isLoading ? "讀取中…" : "未有任務資料"} />
      </Panel>
    </>
  );
}
