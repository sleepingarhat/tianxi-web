import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { AppShell } from "@/components/tx/AppShell";
import { Card, Disclaimer, Empty, ErrorNote, Loading, PageHead, Seg } from "@/components/tx/ui";
import { KpiTile } from "@/components/tx/viz";
import { Button } from "@/components/ui/button";
import { getTrackRecordSummary } from "@/lib/track-record-summary.functions";
import { num } from "@/lib/tx-api";
const Details = lazy(() => import('@/components/tx/TrackRecordDetails').then(m => ({ default: m.TrackRecordDetails })));
const summaryOptions = queryOptions({ queryKey: ['track-record-summary'], queryFn: () => getTrackRecordSummary(), staleTime: 300_000, gcTime: 60 * 60_000, retry: false });

export const Route = createFileRoute("/track-record")({
  head: () => ({
    meta: [
      { title: "公開戰績 · 天喜 TIANXI" },
      { name: "description", content: "每個賽日模型命中率全數公開，賽果以香港賽馬會官方為準，指標只計最終版凍結四揀。" },
      { property: "og:title", content: "公開戰績 · 天喜 TIANXI" },
      { property: "og:description", content: "永久公開對賬：四揀平均中匹數、三甲任中、位置Q、三重彩、四重彩命中率。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(summaryOptions),
  errorComponent: ({ error }) => <AppShell page="engine"><PageHead en="Track Record" title="公開戰績" /><ErrorNote error={error} /><Button variant="outline" onClick={() => window.location.reload()}>重新載入</Button></AppShell>,
  notFoundComponent: () => <Empty label="未有戰績摘要" />,
  component: TrackRecordPage,
});

function TrackRecordPage() {
  const { data, isFetching } = useSuspenseQuery(summaryOptions);
  const [days, setDays] = useState<30 | 60 | 90 | 180>(90);
  const [details, setDetails] = useState(false);
  return <AppShell page="engine" ticker="公開戰績 · 原四揀 · 官方賽果對賬">
    <PageHead en="Verified Track Record" title="公開戰績" desc="四揀平均命中匹數 · 目標 3／4" />
    <div className="mx-4 my-3 grid grid-cols-1 gap-3 md:grid-cols-3">
      {[30, 60, 90].map(window => { const s = data.summary[`last${window}`]; return <KpiTile key={window} label={`近 ${window} 日 · 四揀平均中`} en={`Last ${window} days`} value={num(s?.avgHit, 2)} unit="／4" sub={`${s?.races ?? 0} 場 · 目標 3.00`} tone="gold" />; })}
    </div>
    <p className="mx-4 my-3 text-[11px] text-ink-3">摘要更新：{new Date(Date.parse(data.generatedAt) + 8 * 3600_000).toISOString().slice(0, 16).replace('T', ' ')} HKT{isFetching ? ' · 正在更新' : ''}。沿用公開戰績來源；不以摘要代替逐場凍結核實。</p>
    <Card title="戰績詳細" en="Audit Details" action={<Button variant="outline" onClick={() => setDetails(v => !v)}>{details ? '收起詳細' : '載入詳細'}</Button>}>
      <Seg value={days} onChange={setDays} options={[{ value: 30, label: '近30日' }, { value: 60, label: '近60日' }, { value: 90, label: '近90日' }, { value: 180, label: '近半年' }]} />
    </Card>
    {details ? <Suspense fallback={<Loading label="載入戰績詳細…" />}><Details rollup={data.rollups[String(days)]} /></Suspense> : null}
    <Disclaimer extra="四揀命中分母固定4；市場盤口只作對照。原凍結及官方派彩分開核對。" />
  </AppShell>;
}
