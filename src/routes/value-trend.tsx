import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/tx/AppShell";
import { Card, Disclaimer, ErrorNote, Loading, PageHead, Pill, Scroller, Stat, StatGrid, Table, Td } from "@/components/tx/ui";
import { getValueTrend, type ValueDay } from "@/lib/racing-audit.functions";

export const Route = createFileRoute("/value-trend")({
  head: () => ({
    meta: [
      { title: "值博長期走勢（研究參考）· 天喜 TIANXI" },
      { name: "description", content: "凍結獨贏機率對收市獨贏隱含機率嘅長期走勢：值博Δ為正嘅馬實際勝出數、市場預期、模型預期同平注盈虧。只作研究參考。" },
      { property: "og:title", content: "值博長期走勢（研究參考）· 天喜 TIANXI" },
      { property: "og:description", content: "凍結機率 vs 收市隱含機率，逐賽日公開。只作研究參考。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ValueTrendPage,
});

const money = (v: number) => `${v >= 0 ? "+" : "−"}$${Math.abs(Math.round(v)).toLocaleString()}`;

function Chart({ rows }: { rows: ValueDay[] }) {
  let a = 0, m = 0, w = 0, pnl = 0;
  const pts = rows.map((r) => { a += r.pos_wins; m += r.pos_exp_mk; w += r.pos_exp_model; pnl += r.pos_pnl; return { a, m, w, pnl }; });
  const max = Math.max(1, ...pts.map((p) => Math.max(p.a, p.m, p.w)));
  const W = 320, H = 120, x = (i: number) => (pts.length < 2 ? W / 2 : (i / (pts.length - 1)) * W), y = (v: number) => H - (v / max) * H;
  const line = (k: "a" | "m" | "w") => pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[140px] w-full" role="img" aria-label="值博Δ為正馬匹累計勝出數走勢">
        <path d={line("w")} className="fill-none stroke-gold" strokeWidth={1.5} strokeDasharray="4 3" />
        <path d={line("m")} className="fill-none stroke-ink-3" strokeWidth={1.5} />
        <path d={line("a")} className="fill-none stroke-deep" strokeWidth={2.5} />
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-3 text-[10px] text-ink-3">
        <span><b className="text-deep">━</b> 實際勝出（累計）</span><span><b className="text-ink-3">━</b> 市場隱含預期</span><span><b className="text-gold">┅</b> 凍結模型預期</span>
      </figcaption>
    </figure>
  );
}

function ValueTrendPage() {
  const q = useQuery({ queryKey: ["value-trend"], queryFn: () => getValueTrend(), staleTime: 600_000 });
  const rows = q.data?.days ?? [];
  const t = rows.reduce((s, r) => ({ n: s.n + r.pos_n, w: s.w + r.pos_wins, m: s.m + r.pos_exp_mk, e: s.e + r.pos_exp_model, p: s.p + r.pos_pnl }), { n: 0, w: 0, m: 0, e: 0, p: 0 });
  return (
    <AppShell page="engine" ticker="值博長期走勢 · 只作研究參考">
      <PageHead en="Value Δ Trend · Research" title="值博長期走勢" desc="值博Δ＝凍結獨贏機率 − 收市獨贏隱含機率（兩者每場歸一化、已去抽水）。只統計已結算賽日嘅凍結紀錄，唔改凍結預測。" />
      <div className="mx-4 mt-3 rounded-[8px] border border-gold-strong/40 bg-gold-bg px-3 py-2 text-[11px] font-semibold leading-relaxed text-gold">
        只作研究參考，唔係投注建議，亦唔代表有長期優勢。收市盤喺凍結之後先出現，模型從未用過呢個數。
      </div>
      {q.data?.truncated ? <p className="mx-4 mt-2 text-[11px] font-semibold text-gold">讀取上限提示：以下只計最近 400 個賽日，更早賽日未包括喺統計內。</p> : null}
      {q.isLoading ? <Loading label="計算走勢…" /> : q.error ? <div className="mx-4 mt-3"><ErrorNote error={q.error} /></div> : rows.length ? <>
        <div className="mx-4 mt-3">
          <StatGrid cols={3}>
            <Stat label="值博Δ為正" value={`${t.n.toLocaleString()} 匹`} sub={`${rows.length} 個賽馬日`} />
            <Stat label="實際勝出" value={`${t.w} 匹`} sub={`市場預期 ${t.m.toFixed(1)}／模型預期 ${t.e.toFixed(1)}`} />
            <Stat label="平注 $10 獨贏" value={money(t.p)} sub={`成本 $${(t.n * 10).toLocaleString()}`} />
          </StatGrid>
        </div>
        <div className="lg:grid lg:grid-cols-2">
          <Card title="累計走勢" en="Cumulative">
            <Chart rows={rows} />
            <p className="mt-2 text-[10px] leading-relaxed text-ink-3">實際線貼近市場線＝收市盤已反映晒；貼近模型線＝凍結機率較準。模型預期高過實際，代表凍結機率對呢批馬偏高。</p>
          </Card>
          <Card title="逐賽日值博Δ" en="Per Meeting">
            <Scroller>
              <Table head={["賽日", "Δ>0", "勝出", "市場預期", "模型預期", "平注盈虧", "平均|Δ|"]}>
                {[...rows].reverse().map((r) => (
                  <tr key={r.date}>
                    <Td first>{r.date.slice(2)}</Td><Td>{r.pos_n}</Td><Td>{r.pos_wins}</Td><Td>{r.pos_exp_mk.toFixed(1)}</Td>
                    <Td>{r.pos_exp_model.toFixed(1)}</Td><Td><span className={r.pos_pnl >= 0 ? "text-win" : "text-lose"}>{money(r.pos_pnl)}</span></Td><Td>{(r.mad * 100).toFixed(1)}%</Td>
                  </tr>
                ))}
              </Table>
            </Scroller>
          </Card>
        </div>
        <div className="mx-4 mt-1 flex flex-wrap items-center gap-2 text-[11px]"><Pill>研究口徑</Pill><Link to="/track-record" className="font-bold text-gold">公開戰績 →</Link><Link to="/engine/audit" className="font-bold text-gold">審計與閘 →</Link></div>
      </> : <p className="mx-4 mt-3 text-[12px] text-ink-3">未有已結算而有收市盤嘅凍結紀錄。</p>}
      <Disclaimer />
    </AppShell>
  );
}
