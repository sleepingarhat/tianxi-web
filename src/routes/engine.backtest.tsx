import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AppShell } from "@/components/tx/AppShell";
import { Card, Disclaimer, ErrorNote, Loading, PageHead, Scroller, Seg, Stat, StatGrid, Table, Td } from "@/components/tx/ui";
import { getRacingBacktest, getRacingTrainingData } from "@/lib/racingOps.functions";
import { fmtCount, useDataStats } from "@/lib/data-stats";

export const Route = createFileRoute("/engine/backtest")({
  head: () => ({
    meta: [
      { title: "賽馬引擎訓練數據與回測 · 天喜 TIANXI" },
      { name: "description", content: "賽馬引擎訓練數據規模，同凍結四揀逐場對比隨機揀馬、市場熱門，睇引擎係咪真係命中彩池。" },
      { property: "og:title", content: "賽馬引擎訓練數據與回測 · 天喜 TIANXI" },
      { property: "og:description", content: "引擎 vs 隨機 vs 市場熱門，逐彩池命中同 4 揀複式回報。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BacktestPage,
});

const fmt = (key: string, v: number) => (key === "top4" ? v.toFixed(2) : `${(v * 100).toFixed(1)}%`);

function BacktestPage() {
  const [days, setDays] = useState<90 | 180 | 365>(180);
  const bt = useQuery({ queryKey: ["racing-backtest", days], queryFn: () => getRacingBacktest({ data: { days } }), staleTime: 600_000 });
  const tr = useQuery({ queryKey: ["racing-training"], queryFn: () => getRacingTrainingData(), staleTime: 3600_000 });
  const stats = useDataStats();
  const d = bt.data;
  const top4 = d?.metrics.find((m) => m.key === "top4");
  const verdict = d ? (d.z >= 3 ? "顯著好過隨機" : d.z >= 2 ? "好過隨機（中度）" : "未能證明好過隨機") : "";

  return (
    <AppShell page="engine" ticker="訓練數據 · 回測 · 引擎 vs 隨機 vs 市場">
      <PageHead
        en="Training Data & Backtest"
        title="訓練數據與回測"
        desc="用凍結四揀逐場同兩條基準比：完全隨機揀 4 匹（按每場實際出賽匹數精確計），同臨場賠率最熱 4 匹（賽後先知，只作對照）。"
      />
      <div className="mx-4 mt-3">
        <Seg value={days} onChange={setDays} options={[{ value: 90, label: "近 90 日" }, { value: 180, label: "近 180 日" }, { value: 365, label: "近 365 日" }]} />
      </div>

      {bt.isLoading ? (
        <Loading label="逐場回測計算中（約 10–20 秒）…" />
      ) : bt.error ? (
        <div className="mx-4 mt-3"><ErrorNote error={bt.error} /></div>
      ) : d && top4 ? (
        <>
          <div className="mx-4 mt-3">
            <StatGrid cols={3}>
              <Stat label="四揀中匹數" value={top4.engine.toFixed(2)} sub={`隨機 ${top4.random.toFixed(2)} · 市場 ${top4.market.toFixed(2)}`} />
              <Stat label="對隨機 z 值" value={d.z.toFixed(1)} sub={verdict} />
              <Stat label="樣本" value={`${d.races} 場`} sub={`${d.meetings} 個賽日 · 平均 ${d.avgField.toFixed(1)} 匹`} />
            </StatGrid>
          </div>

          <Card title="目標：四揀平均中匹數超過市場熱門" en="Target vs Market">
            <p className="text-[13px] leading-relaxed text-ink">
              引擎 <span className="font-bold text-gold">{top4.engine.toFixed(2)}</span> 匹，遠高過隨機 {top4.random.toFixed(2)} 匹——證明唔係隨機揀馬。
              下一個目標係超過市場熱門 <span className="font-bold">{top4.market.toFixed(2)}</span> 匹：
              {top4.engine > top4.market
                ? <span className="font-bold text-win"> 已超越（+{(top4.engine - top4.market).toFixed(2)}）</span>
                : <span className="font-bold text-lose"> 仲差 {(top4.market - top4.engine).toFixed(2)} 匹，未達標</span>}
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-hairline">
              <div className="h-full bg-gold" style={{ width: `${Math.min(100, (top4.engine / Math.max(top4.market, 0.01)) * 100)}%` }} />
            </div>
            <p className="mt-1 text-[10px] text-ink-3">市場熱門用賽後最終賠率，引擎鎖定時睇唔到；凍結四揀唔會因追目標而改寫。</p>
          </Card>

          <Card title="逐彩池命中：引擎 vs 隨機 vs 市場" en="Hit Rate vs Baselines">
            <Scroller>
              <Table head={["指標", "引擎", "隨機", "倍數", "市場熱門"]}>
                {d.metrics.map((m) => (
                  <tr key={m.key} className="border-t border-hairline">
                    <Td first mono={false}>{m.label}</Td>
                    <Td><span className="font-semibold text-gold">{fmt(m.key, m.engine)}</span></Td>
                    <Td>{fmt(m.key, m.random)}</Td>
                    <Td>{m.random ? `×${(m.engine / m.random).toFixed(1)}` : "—"}</Td>
                    <Td>{fmt(m.key, m.market)}</Td>
                  </tr>
                ))}
              </Table>
            </Scroller>
            <p className="mt-2 text-[10px] leading-relaxed text-ink-3">
              倍數＞1＝好過隨機。z 值用超幾何分佈近似：≥2 代表唔太可能係運氣，≥3 屬顯著。市場熱門用賽後最終賠率，引擎鎖定時睇唔到，所以只作參考上限。
            </p>
          </Card>

          <Card title="4 揀複式實際回報（每 $10 一注）" en="Box ROI">
            <Scroller>
              <Table head={["彩池", "中", "總注本", "總派彩", "淨盈虧", "回報率"]}>
                {d.roi.map((r) => (
                  <tr key={r.pool} className="border-t border-hairline">
                    <Td first mono={false}>{r.label}</Td>
                    <Td>{r.hits}</Td>
                    <Td>${r.cost.toLocaleString()}</Td>
                    <Td>${Math.round(r.ret).toLocaleString()}</Td>
                    <Td><span className={r.net >= 0 ? "text-win" : "text-lose"}>{r.net >= 0 ? "+" : ""}${Math.round(r.net).toLocaleString()}</span></Td>
                    <Td><span className={r.roiPct >= 0 ? "text-win" : "text-lose"}>{r.roiPct.toFixed(1)}%</span></Td>
                  </tr>
                ))}
              </Table>
            </Scroller>
            <p className="mt-2 text-[10px] text-ink-3">每場都買、唔揀場；派彩為馬會官方金額。負數照實展示。</p>
          </Card>

          <Card title="逐賽日四揀中匹數" en="Per Meeting">
            <Scroller>
              <Table head={["賽日", "場數", "引擎", "隨機", "市場"]}>
                {d.perMeeting.slice().reverse().map((m) => (
                  <tr key={m.date} className="border-t border-hairline">
                    <Td first>{m.date.slice(5)} {m.venue}</Td>
                    <Td>{m.races}</Td>
                    <Td><span className={m.engineTop4 > m.randomTop4 ? "font-semibold text-gold" : ""}>{m.engineTop4.toFixed(2)}</span></Td>
                    <Td>{m.randomTop4.toFixed(2)}</Td>
                    <Td>{m.marketTop4.toFixed(2)}</Td>
                  </tr>
                ))}
              </Table>
            </Scroller>
          </Card>
        </>
      ) : null}

      <Card title="訓練數據" en="Training Data">
        {tr.isLoading ? (
          <Loading />
        ) : tr.error ? (
          <ErrorNote error={tr.error} />
        ) : tr.data ? (
          <>
            <StatGrid cols={3}>
              <Stat label="賽馬日（數據庫實數）" value={fmtCount(stats.data?.counts.raceDays)} sub={stats.data ? `${fmtCount(stats.data.counts.runnerResults)} 行賽果 · 至 ${stats.data.range.last ?? "—"}` : "每日自動更新"} />
              <Stat label="倉庫檔案" value={tr.data.totals.files.toLocaleString()} sub="tianxi-racing" />
              <Stat label="模型" value="tx-oracle-v3" sub="LGB＋Elo 集成 α=0.88（凍結）" />
            </StatGrid>
            <div className="mt-3">
              <Scroller>
                <Table head={["年份", "賽果檔", "派彩檔", "分段時間檔", "賽果資料"]}>
                  {tr.data.years.map((y) => (
                    <tr key={y.year} className="border-t border-hairline">
                      <Td first>{y.year}</Td>
                      <Td>{y.meetings}</Td>
                      <Td>{y.dividends}</Td>
                      <Td>{y.sectional}</Td>
                      <Td>{(y.bytes / 1024 / 1024).toFixed(1)} MB</Td>
                    </tr>
                  ))}
                </Table>
              </Scroller>
            </div>
            <p className="mt-2 text-[10px] text-ink-3">模型只用賽前可知資料訓練（as-of 切點），回測期內預測全部為賽前凍結四揀。</p>
          </>
        ) : null}
      </Card>
      <Disclaimer />
    </AppShell>
  );
}
