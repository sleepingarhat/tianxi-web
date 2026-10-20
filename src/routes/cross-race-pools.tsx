import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/tx/AppShell";
import { ExoticTrioPools } from "@/components/tx/ExoticTrioPools";
import { PageHead, Disclaimer, Loading, ErrorNote } from "@/components/tx/ui";
import { Button } from "@/components/ui/button";
import { txApi } from "@/lib/tx-api";

export const Route = createFileRoute("/cross-race-pools")({
  validateSearch: (search: Record<string, unknown>): { date?: string } => {
    const date = search['date'];
    return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { date } : {};
  },
  head: () => ({ meta: [
    { title: "跨場彩池明細 · 孖T／三T · 天喜" },
    { name: "description", content: "按賽日逐口核對孖T、三T涉及場次、原凍結膽拖、官方組合、命中與正獎及安慰獎派彩。" },
    { property: "og:title", content: "跨場彩池明細 · 天喜" },
    { property: "og:description", content: "逐場核對孖T／三T原注及命中，逐口列成本與派彩；缺證據不結算。" },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: CrossRacePoolsPage,
});

function CrossRacePoolsPage() {
  const { date: requestedDate } = Route.useSearch();
  const [picked, setPicked] = useState("");
  const days = useQuery({ queryKey: ["strategyPnl", 180], queryFn: () => txApi.strategyPnl("?days=180") });
  const dates = [...new Set<string>((days.data?.points ?? []).map((p: { date: string }) => p.date))].sort().reverse();
  const date = picked || requestedDate || dates[0] || "";
  const options = date && !dates.includes(date) ? [date, ...dates] : dates;
  return <AppShell page="engine" columns={false} ticker="孖T／三T · 跨場原注核對">
    <PageHead title="跨場彩池明細" en="Double Trio · Triple Trio" />
    <div className="mx-4 my-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><label htmlFor="cross-day" className="text-sm font-bold">賽馬日</label>
        <select id="cross-day" value={date} onChange={e => setPicked(e.target.value)} className="max-w-full rounded-md border border-hairline bg-paper-2 px-3 py-2 text-sm text-ink">{options.map(d => <option key={d} value={d}>{d}</option>)}</select>
      </div>
      <Button variant="outline" size="sm" asChild><Link to="/strategy-pnl">累計盈虧</Link></Button>
    </div>
    {days.isLoading && !date ? <div className="mx-4"><Loading /></div> : null}
    {days.isError ? <div className="mx-4"><ErrorNote error={days.error} /><Button variant="outline" size="sm" className="mt-2" onClick={() => days.refetch()}>重讀賽日</Button></div> : null}
    {date ? <ExoticTrioPools date={date} detailed /> : null}
    <Disclaimer extra="只核對已存證原注。缺原始副本、第五選或官方替補證據，不入正式成本及派彩。" />
  </AppShell>;
}