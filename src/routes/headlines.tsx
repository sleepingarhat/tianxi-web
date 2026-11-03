import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/tx/AppShell";
import { Card, Empty, PageHead } from "@/components/tx/ui";
import { getRacedayHeadlines } from "@/lib/raceday-official.functions";
import type { HeadlineRow } from "@/lib/raceday-official";

const headlinesQuery = queryOptions({
  queryKey: ["raceday-headlines"],
  // 讀取失敗要拋出等重試，唔可以當成「冇頭條」快取。
  queryFn: async () => {
    const res = await getRacedayHeadlines();
    if (res.failed) throw new Error("頭條存檔暫時讀取唔到");
    return res;
  },
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/headlines")({
  head: () => ({
    meta: [
      { title: "賽日頭條 · 天喜 TIANXI" },
      { name: "description", content: "香港賽馬會每個賽日嘅官方頭條標題及導語，按日期列出，全文連返馬會原文。" },
      { property: "og:title", content: "賽日頭條 · 天喜 TIANXI" },
      { property: "og:description", content: "馬會官方賽日頭條存檔：當日及過往賽日標題、導語同原文連結。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(headlinesQuery),
  component: HeadlinesPage,
  errorComponent: HeadlinesError,
});

function HeadlinesError({ reset }: { reset: () => void }) {
  return (
    <AppShell>
      <PageHead en="RACEDAY FOCUS" title="賽日頭條" desc="馬會官方 · 只屬研究參考" />
      <div className="mx-auto max-w-3xl space-y-3 p-4">
        <p className="rounded-[6px] border border-hairline bg-paper p-3 text-[12px] text-ink-2">暫時讀唔到頭條存檔；呢個唔代表馬會冇公布頭條。</p>
        <button type="button" onClick={reset} className="text-sm font-bold text-gold underline">再試一次</button>
      </div>
    </AppShell>
  );
}

const VENUE = { ST: "沙田", HV: "跑馬地" } as const;
const hkToday = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);

function HeadlineItem({ row }: { row: HeadlineRow }) {
  return (
    <article className="py-3 first:pt-0 last:pb-0">
      <p className="font-mono-tx text-[11px] text-ink-3">
        {row.date} · {VENUE[row.venue]}{row.version ? ` · 第 ${row.version} 版` : ""}
      </p>
      <h3 className="mt-1 font-serif-tc text-[16px] font-bold leading-snug text-ink">{row.title}</h3>
      {row.lead ? <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{row.lead}</p> : null}
      <a href={row.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[12px] font-bold text-gold underline underline-offset-2">
        睇馬會原文 →
      </a>
    </article>
  );
}

function HeadlinesPage() {
  const { data } = useSuspenseQuery(headlinesQuery);
  const rows = data.rows;
  const latestDate = rows[0]?.date ?? null;
  const today = hkToday();
  const current = latestDate ? rows.filter((r) => r.date === latestDate) : [];
  const archive = latestDate ? rows.filter((r) => r.date !== latestDate) : [];
  const currentLabel = latestDate === today ? "今日賽日頭條" : latestDate && latestDate > today ? "下一個賽日頭條" : "最近賽日頭條";

  return (
    <AppShell>
      <PageHead en="RACEDAY FOCUS" title="賽日頭條" desc="馬會官方 · 只屬研究參考：只列標題同導語，全文請睇馬會原文。" />
      <div className="mx-auto max-w-3xl space-y-3 p-4">
        <Link to="/today" className="inline-block text-sm text-gold underline">返賽日頁</Link>
        {!rows.length ? <Empty label="未有已收錄嘅賽日頭條" /> : null}
        {current.length ? (
          <Card title={`${currentLabel}（${current.length} 篇）`} en="LATEST">
            <div className="divide-y divide-hairline">{current.map((r) => <HeadlineItem key={`${r.date}-${r.venue}`} row={r} />)}</div>
          </Card>
        ) : null}
        {archive.length ? (
          <Card title={`過往賽日頭條（${archive.length} 篇）`} en="ARCHIVE">
            <div className="divide-y divide-hairline">{archive.map((r) => <HeadlineItem key={`${r.date}-${r.venue}`} row={r} />)}</div>
          </Card>
        ) : null}
        <p className="text-[10px] leading-relaxed text-ink-3">馬會官方 · 只屬研究參考：頭條係馬會編輯文章，天喜只保存標題、導語、版本同原文指紋，唔轉載正文同圖片，亦唔計入預測及凍結選馬。</p>
      </div>
    </AppShell>
  );
}
