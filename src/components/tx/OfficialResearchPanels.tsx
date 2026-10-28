import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { getHorseOfficialResearch, getMeetingOfficialResearch } from "@/lib/official-research.functions";
import type { OfficialRow, OfficialSection } from "@/lib/official-research";
import { Card, Empty, Loading, Pill, Seg, Table, Td, TxCta } from "./ui";

function Source({ rows }: { rows: OfficialRow[] }) {
  const latest = rows.map(r => String(r['scraped_at'] ?? "")).sort().at(-1);
  return <p className="mt-3 text-[11px] leading-relaxed text-ink-3">馬會官方 · 只屬研究參考{latest ? ` · 收錄 ${latest.slice(0,10)}` : ""}。不計入天喜模型或凍結選馬；未收錄不代表沒有相關紀錄。</p>;
}
function ReferenceTable({ section, fields, headings }: { section: OfficialSection; fields: string[]; headings: string[] }) {
  if (!section.available) return <p role="status" className="py-3 text-[12px] text-ink-3">官方資料暫未能讀取；未當作沒有紀錄。</p>;
  if (!section.rows.length) return <Empty label="此項官方紀錄尚未收錄" />;
  return <div className="overflow-x-auto"><Table head={headings}>{section.rows.map((row, i) => <tr key={i} className="border-b border-hairline last:border-0">{fields.map((field,j) => <Td key={field} first={j===0} className="whitespace-nowrap">{row[field] ?? "—"}</Td>)}</tr>)}</Table></div>;
}
export function HorseOfficialResearch({ horseId }: { horseId: string }) {
  const fn = useServerFn(getHorseOfficialResearch);
  const [tab,setTab] = useState("rating");
  const query = useQuery({ queryKey:["horseOfficialResearch",horseId],queryFn:()=>fn({data:{id:horseId}}),staleTime:600_000 });
  const labels = [{value:"rating",label:"官方評分／體重"},{value:"performance",label:"途程成績"},{value:"movement",label:"搬遷"},{value:"overoar",label:"喘鳴"}];
  const key = tab as "rating"|"performance"|"movement"|"overoar";
  const section = query.data?.[key];
  const columns = {
    rating: { fields:["race_date","rating","body_weight","distance_m","finish_text"],heads:["日期","官方評分","體重","途程（米）","名次"] },
    performance: { fields:["label_a","label_b","starts","wins","seconds","thirds","losses"],heads:["場地","途程","出賽","冠","亞","季","負"] },
    movement: { fields:["arrive_date","from_loc","to_loc"],heads:["到達日期","由","至"] },
    overoar: { fields:["as_of_date","diagnosis_date","surgery"],heads:["名單截至","診斷日期","曾手術（Y／N）"] },
  }[key];
  return <div id="official" className="scroll-mt-20"><Card title="馬會官方馬匹資料" en="Official horse records" action={<Pill>只屬研究參考</Pill>}>
    <Seg options={labels} value={tab} onChange={setTab}/>
    <div className="mt-3">{query.isPending ? <Loading label="讀取馬會官方紀錄…"/> : section ? <ReferenceTable section={section} fields={columns.fields} headings={columns.heads}/> : <Empty label="官方紀錄暫未能讀取"/>}</div>
    <Source rows={section?.rows ?? []}/>
    <TxCta size="sm" variant="outline" className="mt-2" disabled={query.isFetching} onClick={()=>void query.refetch()}>重新讀取</TxCta>
  </Card></div>;
}
export function MeetingOfficialResearch({ date,venue }: { date:string;venue:string }) {
  const fn=useServerFn(getMeetingOfficialResearch);
  const query=useQuery({queryKey:["meetingOfficialResearch",date,venue],queryFn:()=>fn({data:{date,venue}}),staleTime:600_000});
  const [pool,setPool]=useState("jkc");
  const [group,setGroup]=useState("");
  const groups=useMemo(()=>Array.from(new Set(query.data?.draws.rows.map(r=>`${r['racecourse']}／${r['course_label'] || "全天候"}／${r['distance_m']}米`) ?? [])),[query.data]);
  const selected=groups.includes(group) ? group : groups[0];
  const drawRows=query.data?.draws.rows.filter(r=>`${r['racecourse']}／${r['course_label'] || "全天候"}／${r['distance_m']}米`===selected) ?? [];
  const poolRows=query.data?.pools.rows.filter(r=>r['pool']===pool) ?? [];
  return <>
    <Card title="馬會官方騎練王賽果" en="Previous meeting standings" action={<Pill>只屬研究參考</Pill>}>
      <Seg value={pool} onChange={setPool} options={[{value:"jkc",label:"騎師王"},{value:"tnc",label:"練馬師王"}]}/>
      {poolRows[0] ? <p className="mt-2 text-[11px] text-ink-3">賽事日期 {poolRows[0]['meeting_date']} · 已完成賽日，不是今日預測</p> : null}
      <div className="mt-2">{query.isPending ? <Loading/> : <ReferenceTable section={{rows:poolRows,available:query.data?.pools.available ?? false}} fields={["rank_no","person_name","points","wins","seconds","thirds","fourths"]} headings={["名次","姓名","積分","冠","亞","季","殿"]}/>}</div><Source rows={poolRows}/>
    </Card>
    <Card title="馬會官方檔位進階統計" en="Draw reference" action={<Pill>只屬研究參考</Pill>}>
      {groups.length ? <label className="block text-[11px] text-ink-3">跑道／賽道／途程<select aria-label="官方檔位跑道及途程" value={selected} onChange={e=>setGroup(e.target.value)} className="mt-1 block w-full rounded-[6px] border border-hairline bg-paper px-2 py-2 text-[12px] text-ink">{groups.map(g=><option key={g} value={g}>{g.replace("STA","沙田全天候").replace("STT","沙田草地").replace("HVT","跑馬地草地")}</option>)}</select></label> : null}
      <div className="mt-2">{query.isPending ? <Loading/> : <ReferenceTable section={{rows:drawRows,available:query.data?.draws.available ?? false}} fields={["draw","starts","win_pct","place_pct"]} headings={["檔位","出賽","勝出率 %","上名率 %"]}/>}</div><Source rows={drawRows}/>
    </Card>
  </>;
}