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
const summaryOptions = queryOptions({ queryKey: ['track-record-summary'], queryFn: () => getTrackRecordSummary(), staleTime: 300_000, refetchInterval: 300_000, gcTime: 60 * 60_000, retry: false });

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
  const { data, isFetching, isRefetchError } = useSuspenseQuery(summaryOptions);
  const [days, setDays] = useState<30 | 60 | 90 | 180>(90);
  const [details, setDetails] = useState(false);
  return <AppShell page="engine" ticker="公開戰績 · 原四揀 · 官方賽果對賬">
    <PageHead en="Verified Track Record" title="公開戰績" desc="四揀平均命中匹數 · 目標 3／4 · 統一凍結起計日 2026-10-04" />
    <div className="mx-4 my-3 grid grid-cols-1 gap-3 md:grid-cols-3">
      {[30, 60, 90].map(window => { const s = data.summary[`last${window}`]; return <KpiTile key={window} label={`近 ${window} 日 · 四揀平均中`} en={`Last ${window} days`} value={num(s?.avgHit, 2)} unit="／4" sub={`${s?.races ?? 0} 場 · 目標 3.00`} tone="gold" />; })}
    </div>
    <Card title="收市市場對照" en="Closing Market">
      <Seg value={days} onChange={setDays} options={[{ value: 30, label: '近30日' }, { value: 60, label: '近60日' }, { value: 90, label: '近90日' }, { value: 180, label: '近半年' }]} />
      {data.market?.[String(days)] ? <p className="mt-3 text-[12px] text-ink-2">同場引擎 {num(data.market[String(days)]?.pairedModel, 2)}／4 · 市場 {num(data.market[String(days)]?.average, 2)}／4 · {data.market[String(days)]?.races} 場可對照</p> : <p className="mt-3 text-[12px] text-ink-3">市場摘要暫未完整；原四揀戰績不受影響。</p>}
    </Card>
    <Card title="已結算預測版本" en="Recorded Versions">
      {data.versions ? data.versions.versions.slice(0, 3).map(v => <p key={`${v.version}-${v.source}`} className="break-words border-b border-hairline py-2 text-[12px] text-ink-2"><b>{v.version}</b> · {v.firstDate} 至 {v.lastDate} · {v.rows} 筆</p>) : <p className="text-[12px] text-ink-3">版本摘要暫未完整</p>}
      <p className="mt-2 text-[10px] text-ink-3">版本名稱屬已結算紀錄，不等同逐場鎖點模型指紋證明。{data.versions?.truncated ? '只列最近100組；完整資料見詳細。' : ''}</p>
    </Card>
    <p className="mx-4 my-3 text-[11px] text-ink-3">摘要更新：{new Date(Date.parse(data.generatedAt) + 8 * 3600_000).toISOString().slice(0, 16).replace('T', ' ')} HKT{isFetching ? ' · 正在讀取最新摘要' : ''}{isRefetchError ? ' · 暫未能更新，以下保留上次完整摘要' : ''}。上次完整統計；每小時更新，不代表即時戰績，不以摘要代替逐場凍結核實。</p>
    <Card title="戰績詳細" en="Audit Details" action={<Button variant="outline" onClick={() => setDetails(v => !v)}>{details ? '收起詳細' : '載入詳細'}</Button>}>
      <Seg value={days} onChange={setDays} options={[{ value: 30, label: '近30日' }, { value: 60, label: '近60日' }, { value: 90, label: '近90日' }, { value: 180, label: '近半年' }]} />
    </Card>
    {details ? <Suspense fallback={<Loading label="載入戰績詳細…" />}><Details rollup={data.rollups[String(days)]} /></Suspense> : null}
    <Disclaimer extra="四揀命中分母固定4；市場盤口只作對照。原凍結及官方派彩分開核對。" />
  </AppShell>;
}
