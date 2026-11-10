import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { OFFICIAL_COPY_NOTE, emptyBoardLabel, fetchOfficialBoard, type OfficialEnvelope } from "@/lib/official-boards";

import { Card, Empty, ErrorNote, Loading } from "./ui";

export function useBoard(path: string | null) {
  return useQuery({
    queryKey: ["official-board", path],
    queryFn: () => fetchOfficialBoard(path!),
    enabled: path != null,
    staleTime: 120_000,
  });
}

export function note() {
  return <p className="mt-2 text-[11px] leading-relaxed text-ink-3">{OFFICIAL_COPY_NOTE}</p>;
}

export function Count({ n }: { n: number }) {
  return <p className="text-[11px] text-ink-3">共 {n} 筆</p>;
}

export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-2 flex items-center justify-between gap-2 text-[12px]">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="font-bold text-ink-2 disabled:opacity-40">上一頁</button>
      <span className="tabnum font-mono-tx text-ink-3">{page} / {pages}</span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className="font-bold text-ink-2 disabled:opacity-40">下一頁</button>
    </div>
  );
}

export function BoardCard({
  id,
  title,
  en,
  path,
  query,
  read,
  render,
  toolbar,
  action,
}: {
  id: string;
  title: string;
  en: string;
  path: string | null;
  query: ReturnType<typeof useBoard>;
  read: (envelope: OfficialEnvelope) => unknown[];
  render: (rows: unknown[], envelope: OfficialEnvelope) => ReactNode;
  /** 分頁等控制，讀取中都保留。 */
  toolbar?: ReactNode;
  action?: ReactNode;
}) {
  let body: ReactNode;
  if (!path) body = <p className="text-[12px] text-ink-3">請揀日期同馬場。</p>;
  else if (query.isPending) body = <Loading label="讀取官方資料…" />;
  else if (query.isError) body = <ErrorNote error={query.error} />;
  else if (!query.data) body = <Empty label={emptyBoardLabel(false)} />;
  else {
    const rows = read(query.data);
    body = !query.data.available || !rows.length
      ? <Empty label={emptyBoardLabel(query.data.available)} />
      : render(rows, query.data);
  }
  return (
    <Card title={title} en={en} action={action}>
      <div id={`official-${id}`} className="scroll-mt-20">
        {toolbar ? <div className="mb-2">{toolbar}</div> : null}
        {body}
        {note()}
      </div>
    </Card>
  );
}

