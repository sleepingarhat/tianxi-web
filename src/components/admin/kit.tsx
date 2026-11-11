// 監控端共用組件：頁頭、面板、KPI（count up）、狀態章、TanStack Table 資料表
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { RefreshCw } from "lucide-react";

export function AdminHead({
  title,
  en,
  desc,
  onRefresh,
  refreshing,
  updatedAt,
}: {
  title: string;
  en: string;
  desc?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  updatedAt?: string | null;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-end gap-3 border-b border-hairline pb-3">
      <div className="min-w-0 flex-1">
        <p className="font-mono-tx text-[11px] font-medium tracking-[0.04em] text-gold">{en}</p>
        <h1 className="mt-0.5 text-[20px] font-bold text-ink">{title}</h1>
        {desc ? <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-ink-3">{desc}</p> : null}
      </div>
      {updatedAt ? <span className="tabnum font-mono-tx text-[10px] text-ink-3">更新 {updatedAt}</span> : null}
      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-[6px] border border-hairline bg-paper-2 px-2.5 py-1.5 text-[11px] text-ink-2 transition-colors hover:border-gold hover:text-ink disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "更新中" : "重新整理"}
        </button>
      ) : null}
    </header>
  );
}

export function Panel({ title, en, children, right, className = "" }: { title: string; en?: string; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-[12px] border border-hairline bg-paper-2 p-4 ${className}`}>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[13px] font-bold text-ink">{title}</h2>
        {en ? <span className="font-mono-tx text-[10.5px] tracking-[0.04em] text-ink-3">{en}</span> : null}
        <div className="ml-auto">{right}</div>
      </div>
      {children}
    </section>
  );
}

/** 數字 count up：只做一次、約 600ms；非數字直接顯示 */
export function CountUp({ value, digits = 0, prefix = "", suffix = "" }: { value: number | null | undefined; digits?: number; prefix?: string; suffix?: string }) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (value == null || !Number.isFinite(value)) return;
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 600);
      const e = 1 - Math.pow(1 - k, 3);
      setV(a + (value - a) * e);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  if (value == null || !Number.isFinite(value)) return <>—</>;
  return (
    <>
      {prefix}
      {v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}
      {suffix}
    </>
  );
}

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "gold" | "win" | "lose" | undefined }) {
  const c = tone === "win" ? "text-win" : tone === "lose" ? "text-lose" : tone === "gold" ? "text-gold" : "text-ink";
  return (
    <div className="min-w-0 rounded-[12px] border border-hairline bg-paper-2 px-3 py-2.5">
      <p className="truncate text-[10px] text-ink-3">{label}</p>
      <p className={`tabnum mt-0.5 truncate font-mono-tx text-[20px] font-bold ${c}`}>{value}</p>
      {sub ? <p className="mt-0.5 truncate text-[10px] text-ink-3">{sub}</p> : null}
    </div>
  );
}

export type Status = "PASS" | "WATCH" | "FAIL" | "ok" | "warn" | "fail" | "unknown" | "stale" | "missing";
const STATUS_TXT: Record<Status, string> = {
  PASS: "PASS", WATCH: "WATCH", FAIL: "FAIL", ok: "正常", warn: "留意", fail: "失敗", unknown: "未知", stale: "過時", missing: "缺失",
};
export function StatusBadge({ s, label }: { s: Status; label?: string }) {
  const good = s === "PASS" || s === "ok";
  const bad = s === "FAIL" || s === "fail" || s === "missing";
  const dot = good ? "bg-win" : bad ? "bg-lose" : s === "unknown" ? "bg-ink-3" : "bg-gold";
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hairline px-2 py-0.5 text-[10px] text-ink-2">
      <span className={`h-1.5 w-1.5 rounded-full ${dot} ${good ? "soft-pulse" : ""}`} />
      {label ?? STATUS_TXT[s]}
    </span>
  );
}

export function NoteBox({ children, tone = "ink" }: { children: ReactNode; tone?: "ink" | "lose" | "gold" }) {
  const b = tone === "lose" ? "border-lose/50" : tone === "gold" ? "border-gold/50" : "border-hairline";
  return <p className={`rounded-[8px] border ${b} bg-paper-3 px-3 py-2 text-[11px] leading-relaxed text-ink-2`}>{children}</p>;
}

/** TanStack Table：排序、全局搜尋、分頁；窄畫面橫向捲動 */
export function DataTable<T>({
  data,
  columns,
  pageSize = 20,
  searchable = true,
  empty = "暫無資料",
}: {
  data: T[];
  columns: ColumnDef<T, any>[];
  pageSize?: number;
  searchable?: boolean;
  empty?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filter, setFilter] = useState("");
  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });
  const total = table.getFilteredRowModel().rows.length;
  const pages = table.getPageCount();
  return (
    <div className="min-w-0">
      {searchable ? (
        <div className="mb-2 flex items-center gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="搜尋…"
            className="tx-field-sm w-full max-w-xs"
          />
          <span className="tabnum ml-auto shrink-0 font-mono-tx text-[10px] text-ink-3">{total.toLocaleString()} 行</span>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-[8px] border border-hairline">
        <table className="w-full min-w-[560px] border-collapse text-[11px]">
          <thead className="bg-paper-3">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const dir = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
                      className={`whitespace-nowrap border-b border-hairline px-2.5 py-2 text-left font-medium text-ink-3 ${h.column.getCanSort() ? "cursor-pointer select-none hover:text-ink" : ""}`}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {dir ? <span className="ml-1 text-gold">{dir === "asc" ? "▲" : "▼"}</span> : null}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((r) => (
                <tr key={r.id} className="border-b border-hairline transition-colors last:border-b-0 hover:bg-gold-bg">
                  {r.getVisibleCells().map((c) => (
                    <td key={c.id} className="max-w-[260px] whitespace-normal break-words px-2.5 py-1.5 align-top leading-relaxed text-ink-2 [overflow-wrap:anywhere]">
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-[12px] text-ink-3">
                  {filter ? (
                    <>
                      搵唔到符合「{filter}」嘅資料{" "}
                      <button type="button" className="ml-1 text-gold underline" onClick={() => setFilter("")}>清除搜尋</button>
                    </>
                  ) : (
                    empty
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <div className="mt-2 flex items-center justify-end gap-2 text-[11px] text-ink-3">
          <button type="button" className="rounded-[6px] border border-hairline px-2 py-1 disabled:opacity-40" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>上一頁</button>
          <span className="tabnum font-mono-tx">{table.getState().pagination.pageIndex + 1} / {pages}</span>
          <button type="button" className="rounded-[6px] border border-hairline px-2 py-1 disabled:opacity-40" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>下一頁</button>
        </div>
      ) : null}
    </div>
  );
}

export function useMemoCols<T>(f: () => ColumnDef<T, any>[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(f, []);
}

export const fmtMoney = (v: number | null | undefined, digits = 1) =>
  v == null || !Number.isFinite(v) ? "—" : `${v < 0 ? "−" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const fmtPct = (v: number | null | undefined, digits = 1) => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(digits)}%`);
