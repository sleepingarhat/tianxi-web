import { detailDeadline } from "@/lib/detail-deadline";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { getCoverageAudit } from "@/lib/racing-visibility.functions";
import { DISTANCE_BANDS, summarizeCoverage } from "@/lib/racing-visibility";
import { Card, Empty, ErrorNote, Loading, Pill, Scroller, Seg, Stat, StatGrid, Table, Td } from "./ui";

export function useCoverageAudit(days = 180) {
  const read = useServerFn(getCoverageAudit);
  return useQuery({ queryKey: ["coverage-audit", days], queryFn: () => detailDeadline(() => read({ data: { days } })), retry: false, staleTime: 300_000, refetchInterval: 300_000 });
}
const fmt = (n: number | null) => n == null ? "—" : n.toFixed(2);
export function CoverageAudit({ days = 180, showMeetings = false }: { days?: number; showMeetings?: boolean }) {
  const q = useCoverageAudit(days);
  const [group, setGroup] = useState<"cross" | "venue" | "dist">("cross");
  const rows = q.data?.rows ?? [], summary = summarizeCoverage(rows);
  const groups = group === "venue" ? ["ST", "HV"].map(venue => ({ label: venue === "ST" ? "沙田" : "跑馬地", rows: rows.filter(r => r.venue === venue) }))
    : group === "dist" ? DISTANCE_BANDS.map(band => ({ label: band, rows: rows.filter(r => r.band === band) }))
    : ["ST", "HV"].flatMap(venue => DISTANCE_BANDS.map(band => ({ label: `${venue === "ST" ? "沙田" : "跑馬地"} · ${band}`, rows: rows.filter(r => r.venue === venue && r.band === band) })));
  return <>
    <Card title="凍結四揀 × 收市市場對照" en="Daily coverage audit" action={<Pill tone={q.data?.failed.length ? "lose" : "gold"}>{q.isFetching ? "更新中" : "只讀"}</Pill>}>
      {q.isLoading ? <Loading /> : q.error ? <div><ErrorNote error={q.error} /><Button variant="outline" onClick={() => void q.refetch()}>重新讀取分層對照</Button></div> : rows.length ? <>
        <StatGrid cols={2}>
          <Stat label="凍結四揀平均中" value={fmt(summary.model)} sub={`／4 · ${summary.n} 場`} />
          <Stat label="收市市場平均中" value={fmt(summary.market)} sub={`／4 · ${summary.paired} 場可對照`} />
        </StatGrid>
        <p className="my-3 text-[11px] leading-relaxed text-ink-2">同場配對：引擎 {fmt(summary.pairedModel)}／4、市場 {fmt(summary.market)}／4；{summary.missing} 場無法作市場對照：未有完整收市獨贏賠率，或第4及第5熱門同賠率。只排除市場比較，唔代表冇預測或投注輸咗。</p>
        <Seg value={group} onChange={setGroup} options={[{ value: "cross", label: "馬場×途程" }, { value: "venue", label: "馬場" }, { value: "dist", label: "途程" }]} />
        <Scroller><Table head={["分層", "配對場", "引擎／4", "市場／4", "未能對照"]}>
          {groups.map(g => { const s = summarizeCoverage(g.rows); return <tr key={g.label} className="border-b border-hairline"><Td first><span className="text-[10px]">{g.label}</span></Td><Td>{s.paired}</Td><Td className="font-bold text-gold">{fmt(s.pairedModel)}</Td><Td>{fmt(s.market)}</Td><Td>{s.missing}</Td></tr>; })}
        </Table></Scroller>
        <p className="mt-3 text-[10px] leading-relaxed text-ink-3">短途 ≤1200米；一哩 1201–1650米；中長 1651–2000米；長途 &gt;2000米。市場以全場已出賽馬匹收市獨贏由低至高揀4匹（等同隱含機率排序）；不以頭4名的賠率代替全場。不足10場只作記錄；2.31只係歷史參考，唔係本窗市場實數。</p>
        <p className="mt-2 text-[10px] text-ink-3">讀取窗口 {q.data?.from} 至 {q.data?.to ?? "—"} · 自動跟已入帳凍結賽日更新</p>
        {q.data?.excluded ? <p className="mt-2 text-[10px] text-ink-3">另有 {q.data.excluded} 場未標示凍結或缺完整四揀／賽果，未納本表；因此場數可與原滾動統計不同。</p> : null}
        {q.data?.failed.length ? <p className="mt-2 text-[10px] text-lose">未讀到賽日：{q.data.failed.join("、")}；以上係部分資料，唔代表完整統計。</p> : null}
      </> : <Empty label="未有完整凍結四揀及賽果" />}
    </Card>
    {showMeetings && q.data ? <Card title="逐賽日凍結拆解" en="Frozen meetings"><div className="grid grid-cols-2 gap-2">{q.data.meetings.map(m => <Link key={m.date} to="/explain/$date" params={{ date: m.date }} className="border-b border-hairline py-2 text-[11px] text-ink"><b className="tabnum font-mono-tx">{m.date}</b><span className="mt-1 block text-[10px] text-ink-3">{m.venue === "HV" ? "跑馬地" : "沙田"} · {m.races.length} 場 →</span></Link>)}</div></Card> : null}
  </>;
}