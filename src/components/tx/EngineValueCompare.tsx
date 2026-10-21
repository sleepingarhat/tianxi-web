import { detailDeadline } from "@/lib/detail-deadline";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getFrozenVersionHistory } from "@/lib/racing-evidence.functions";
import { getValueComparison } from "@/lib/racing-visibility.functions";
import { fmtMeetingDate, num } from "@/lib/tx-api";
import { EChart } from "./EChart";
import { Card, Empty, ErrorNote, Loading } from "./ui";

/** 引擎價值對照：只讀凍結四揀與收市獨贏，唔改模型或凍結。 */
export function EngineValueCompare() {
  const readHistory = useServerFn(getFrozenVersionHistory);
  const readValue = useServerFn(getValueComparison);
  const hist = useQuery({ queryKey: ["frozen-model-version-history"], queryFn: () => detailDeadline(() => readHistory()), retry: false, staleTime: 300_000 });
  const rows = hist.data?.versions ?? [];
  const current = rows.slice().sort((a, b) => b.lastDate.localeCompare(a.lastDate))[0];
  const from = current ? rows.filter(r => r.version === current.version).map(r => r.firstDate).sort()[0] : undefined;
  const q = useQuery({ queryKey: ["engine-value-v2", from, current?.version], queryFn: () => {
    if (!from || !current?.version) throw new Error("未有版本起計紀錄");
    return detailDeadline(() => readValue({ data: { from, version: current.version } }));
  }, retry: false, enabled: Boolean(from && current?.version), staleTime: 600_000 });
  const s = q.data?.summary;
  const t = q.data?.trend ?? [];
  const pct = (v: number | null | undefined) => `${Math.max(0, Math.min(100, ((v ?? 0) / 4) * 100))}%`;
  const css = (v: string) => typeof window === "undefined" ? "#888" : getComputedStyle(document.documentElement).getPropertyValue(v).trim() || "#888";

  return (
    <Card title={`引擎價值對照${from ? `（由 ${fmtMeetingDate(from)} 起）` : ""}`} en="Value vs Market">
      {hist.isLoading || q.isLoading ? <Loading /> : hist.error || q.error ? <div><ErrorNote error={hist.error || q.error} /><Button variant="outline" onClick={() => { if (hist.error) void hist.refetch(); else void q.refetch(); }}>重新讀取市場對照</Button></div> : !s || !s.races ? <Empty label="當前版本未有已入帳賽日" /> : (
        <div className="space-y-2.5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-[10px] border border-hairline bg-paper p-3">
            <div className="text-center">
              <p className="text-[10px] font-bold text-ink-3">引擎命中馬平均獨贏</p>
              <p className="tabnum font-mono-tx text-[28px] font-bold leading-tight text-win">{num(s.engineOdds, 1)}</p>
              <p className="text-[9px] text-ink-3">{s.engineSamples} 匹命中</p>
            </div>
            <div className="text-center">
              <span className="rounded-[4px] border border-gold-strong/60 bg-gold-bg px-1.5 py-0.5 text-[10px] font-bold text-gold">
                {s.oddsEdge != null && s.oddsEdge > 0 ? "更高 ▲" : "對照"}
              </span>
              <p className="tabnum mt-1 font-mono-tx text-[11px] font-bold text-gold">{s.oddsEdge != null ? `${s.oddsEdge >= 0 ? "+" : ""}${s.oddsEdge.toFixed(1)}` : "—"}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold text-ink-3">市場頭四命中馬平均獨贏</p>
              <p className="tabnum font-mono-tx text-[28px] font-bold leading-tight text-ink-2">{num(s.marketOdds, 1)}</p>
              <p className="text-[9px] text-ink-3">{s.marketSamples} 匹命中</p>
            </div>
          </div>
          <div className="space-y-1.5 rounded-[10px] border border-hairline bg-paper p-2.5">
            {[["引擎四揀平均命中", s.engineHits, "bg-win"], ["市場頭四平均命中", s.marketHits, "bg-ink-3"]].map(([k, v, c]) => (
              <div key={k as string} className="flex items-center gap-2 text-[10px]">
                <span className="w-24 shrink-0 font-bold text-ink-2">{k as string}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-paper-2"><span className={`block h-full ${c}`} style={{ width: pct(v as number) }} /></span>
                <span className="tabnum w-14 text-right font-mono-tx font-bold text-ink">{num(v as number, 2)} / 4</span>
              </div>
            ))}
            <p className="text-[9px] text-ink-3">命中差距（市場 − 引擎）{s.hitGap != null ? s.hitGap.toFixed(2) : "—"} 匹 · {s.races} 場 / {q.data?.meetings} 日</p>
          </div>
          {t.length > 1 ? (
            <EChart height={170} ariaLabel="滾動命中與命中馬平均賠率走勢" option={{
              grid: { left: 30, right: 34, top: 24, bottom: 22 },
              tooltip: { trigger: "axis" },
              legend: { top: 0, textStyle: { fontSize: 9 }, itemWidth: 10 },
              xAxis: { type: "category", data: t.map(d => d.date.slice(5)), axisLabel: { fontSize: 9 } },
              yAxis: [{ type: "value", min: 0, max: 4, axisLabel: { fontSize: 9 } }, { type: "value", axisLabel: { fontSize: 9 }, splitLine: { show: false } }],
              series: [
                { name: "引擎命中", type: "line", data: t.map(d => d.engineHits && +d.engineHits.toFixed(2)), color: css("--tx-win"), symbol: "none" },
                { name: "市場命中", type: "line", data: t.map(d => d.marketHits && +d.marketHits.toFixed(2)), color: css("--tx-ink-3"), symbol: "none" },
                { name: "引擎賠率", type: "line", yAxisIndex: 1, lineStyle: { type: "dashed" }, data: t.map(d => d.engineOdds && +d.engineOdds.toFixed(1)), color: css("--tx-gold"), symbol: "none" },
                { name: "市場賠率", type: "line", yAxisIndex: 1, lineStyle: { type: "dashed" }, data: t.map(d => d.marketOdds && +d.marketOdds.toFixed(1)), color: css("--tx-ink-2"), symbol: "none" },
              ],
            }} />
          ) : null}
          <p className="font-serif-tc text-[12px] font-bold text-ink">
            {s.oddsEdge != null && s.oddsEdge > 0 && (s.hitGap ?? 0) <= 0.5 ? "命中馬更冷，覆蓋接近，具值博參考價值。" : "引擎與市場數字如實並列，僅供參考。"}
          </p>
          <p className="text-[9px] leading-relaxed text-ink-3">截至最近已入帳賽日 {q.data?.to ? fmtMeetingDate(q.data.to) : "—"}，每日對帳後自動更新。只計當前凍結版本 {current?.version} 嘅最終凍結四揀；賠率為收市獨贏；收市價缺漏或第四熱門同價嘅場次唔計。只讀資料，唔改模型或凍結。</p>
        </div>
      )}
    </Card>
  );
}
