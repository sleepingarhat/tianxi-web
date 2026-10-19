import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { exoticPoolOptions } from "@/lib/racingPoolAccounting";

import { AdminHead, Kpi, NoteBox, Panel, fmtMoney, fmtPct } from "@/components/admin/kit";
import { useRacingPnl } from "@/components/admin/data";
import { EChart } from "@/components/tx/EChart";
import { ExoticTrioPools } from "@/components/tx/ExoticTrioPools";
import { SinglePoolDaily } from "@/components/tx/SinglePoolDaily";
import { txApi } from "@/lib/tx-api";
import { hkToday } from "@/lib/hkTime";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/pnl")({
  head: () => ({ meta: [{ title: "盈虧 · 天喜監控端" }, { name: "description", content: "天喜賽馬策略、孖T三T逐日成本派彩。" }, { property: "og:title", content: "盈虧 · 天喜監控端" }, { property: "og:description", content: "核對賽馬跨場彩池。" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Pnl,
});

function curve(points: { x: string; v: number }[]) {
  let cum = 0, peak = 0, dd = 0;
  const cumArr = points.map((p) => { cum += p.v; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); return { x: p.x, cum }; });
  return { cumArr, maxDD: dd, total: cum };
}

const chart = (data: { x: string; cum: number }[], name: string) => ({
  backgroundColor: "transparent",
  textStyle: { color: "#D0D6D0" },
  tooltip: { trigger: "axis" as const },
  grid: { left: 56, right: 12, top: 16, bottom: 28 },
  xAxis: { type: "category" as const, data: data.map((d) => d.x), axisLine: { lineStyle: { color: "rgba(212,161,30,0.3)" } } },
  yAxis: { type: "value" as const, splitLine: { lineStyle: { color: "rgba(212,161,30,0.08)" } } },
  series: [{ name, type: "line" as const, showSymbol: false, data: data.map((d) => Math.round(d.cum * 10) / 10), lineStyle: { color: "#D4A11E" }, areaStyle: { color: "rgba(212,161,30,0.12)" } }],
});

function Pnl() {
  const rp = useRacingPnl();
  const meets = useQuery({ queryKey: ["meetings", 12], queryFn: () => txApi.meetings("?limit=12") });
  const [trioDate, setTrioDate] = useState("");
  const dates: string[] = [...new Set<string>((meets.data?.meetings ?? []).map((m: { date?: string }) => String(m.date ?? "")).filter((d: string) => d && d <= hkToday()))].sort().reverse();
  const selectedDate = trioDate || dates[0] || "";
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);

  const allPts = ((rp.data?.points ?? []) as import('@/lib/racing-shapes').StrategyPoint[]);
  const exQ = useQueries({ queries: allPts.map((p) => exoticPoolOptions(String(p.date))) });
  const exKey = exQ.map((q) => q.dataUpdatedAt).join(",");
  const racing = useMemo(() => {
    const cross = { DT: { cost: 0, payout: 0, wins: 0, bets: 0 }, TT: { cost: 0, payout: 0, wins: 0, bets: 0 } };
    const merged = allPts.map((p, i) => {
      let cost = Number(p.cost) || 0, net = Number(p.net) || 0;
      if (inRange(String(p.date))) for (const pool of exQ[i]?.data?.pools ?? []) {
        if (pool.missing) continue;
        const ret = pool.payout + pool.consPayout;
        const b = cross[pool.name.includes("孖T") ? "DT" : "TT"];
        b.cost += pool.cost; b.payout += ret; b.bets++; if (ret > 0) b.wins++;
        cost += pool.cost; net += ret - pool.cost;
      }
      return { ...p, cost, net };
    });
    const raw = merged.filter((p) => inRange(String(p.date)));
    const pts = raw.map((p) => ({ x: p.date as string, v: p.net }));
    const cost = raw.reduce((a, p) => a + p.cost, 0);
    const races = raw.reduce((a, p) => a + (Number(p.racesBet) || 0), 0);
    const c = curve(pts);
    return { ...c, cost, races, cross, days: raw.length, roi: cost ? (c.total / cost) * 100 : null, first: raw[0]?.date, last: raw[raw.length - 1]?.date };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rp.data, from, to, exKey]);
  const crossLoading = exQ.some((q) => q.isLoading);


  return (
    <>
      <AdminHead title="盈虧" en="P&L" desc="賽馬每注 $10；四揀複式累計與孖T／三T 逐日核對分開列。負數照實展示。" onRefresh={() => { rp.refetch(); meets.refetch(); }} refreshing={rp.isFetching} />
      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-[8px] border border-hairline bg-paper-3 px-3 py-2">
        <label className="text-[11px] text-ink-3">由<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-1 rounded-[6px] border border-hairline bg-paper px-2 py-1 text-[11px] text-ink" /></label>
        <label className="text-[11px] text-ink-3">至<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ml-1 rounded-[6px] border border-hairline bg-paper px-2 py-1 text-[11px] text-ink" /></label>
        {[["", "全部"], [-30, "近30日"], [-90, "近90日"]].map(([d, l]) => (
          <button key={String(l)} type="button" onClick={() => { setTo(""); setFrom(d === "" ? "" : new Date(Date.now() + Number(d) * 864e5).toISOString().slice(0, 10)); }} className="rounded-[6px] border border-hairline bg-paper px-2 py-1 text-[11px] text-ink-2">{l}</button>
        ))}
        <span className="text-[10px] text-ink-3">日期篩選適用於賽馬累計。</span>
      </div>
      <Panel title="賽馬策略" en="Racing · $10/注">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="淨盈虧" value={fmtMoney(racing.total, 0)} tone={racing.total >= 0 ? "win" : "lose"} sub={`${racing.first ?? "—"} 至 ${racing.last ?? "—"}`} />
          <Kpi label="回報率 ROI" value={fmtPct(racing.roi)} sub={`成本 ${fmtMoney(racing.cost, 0)}`} />
          <Kpi label="最大回撤" value={fmtMoney(racing.maxDD, 0)} tone="lose" />
          <Kpi label="投注場數" value={racing.races || "—"} sub={`${racing.days} 個賽馬日`} />
        </div>
        {racing.cumArr.length ? <div className="mt-3"><EChart height={220} ariaLabel="賽馬累計盈虧" option={chart(racing.cumArr.map((d) => ({ x: d.x, cum: d.cum })), "累計")} /></div> : null}
        {rp.data?.poolBreakdown ? (<>
          <p className="mt-3 text-[10px] text-ink-3">以下分彩池數字為全期總數，後端未提供逐日分池，唔受日期篩選影響。</p>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            {Object.entries(rp.data.poolBreakdown as Record<string, any>).map(([k, v]) => (
              <div key={k} className="rounded-[8px] border border-hairline bg-paper-3 px-3 py-2">
                <p className="text-[10px] text-ink-3">{({ FF: "四連環", TRIO: "單T", TIERCE: "三重彩", QUARTET: "四重彩" } as Record<string, string>)[k] ?? k}</p>
                <p className={`tabnum font-mono-tx text-[14px] ${v.net >= 0 ? "text-win" : "text-lose"}`}>{fmtMoney(v.net, 0)}</p>
                <p className="text-[10px] text-ink-3">中 {v.wins} / {v.bets}</p>
              </div>
            ))}
          </div>
        </>) : null}
        <p className="mt-3 text-[10px] text-ink-3">孖T／三T（二拖三，兩場／三場都中先計正獎）已併入上面淨盈虧同曲線，按日期篩選；缺第五選口數不計。{crossLoading ? "跨場資料讀取中…" : ""}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          {([["DT", "孖T"], ["TT", "三T"]] as const).map(([k, nm]) => { const v = racing.cross[k]; const net = v.payout - v.cost; return (
            <div key={k} className="rounded-[8px] border border-hairline bg-paper-3 px-3 py-2">
              <p className="text-[10px] text-ink-3">{nm}</p>
              <p className={`tabnum font-mono-tx text-[14px] ${net >= 0 ? "text-win" : "text-lose"}`}>{fmtMoney(net, 0)}</p>
              <p className="text-[10px] text-ink-3">中 {v.wins} / {v.bets} 口 · 成本 {fmtMoney(v.cost, 0)}</p>
            </div>); })}
        </div>
      </Panel>

      <section className="mt-4 min-w-0" aria-label="孖T三T逐日核對">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label id="trio-date-label" className="text-[12px] font-bold text-ink">逐場彩池 賽馬日</label>
          <Select value={selectedDate} onValueChange={setTrioDate}>
            <SelectTrigger aria-labelledby="trio-date-label" className="w-[170px] border-hairline bg-paper-3 text-ink"><SelectValue placeholder="選擇賽馬日" /></SelectTrigger>
            <SelectContent>{dates.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <p className="mb-3 text-[11px] leading-relaxed text-ink-3">二拖三複式：孖T 9 注 $90，三T 27 注 $270。正獎、安慰獎與成本逐日核對，未併入上方四揀累計。</p>
        {selectedDate ? <div className="space-y-3"><SinglePoolDaily date={selectedDate} /><ExoticTrioPools date={selectedDate} /></div> : <NoteBox>{meets.isError ? "賽馬日讀取失敗，請重新整理。" : meets.isLoading ? "讀取賽馬日中…" : "暫無賽馬日資料。"}</NoteBox>}
      </section>


    </>
  );
}
