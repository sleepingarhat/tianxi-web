import { FeaturePageGate } from "@/components/tx/gates/FeaturePageGate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useStrategyAccounting } from "@/lib/useStrategyAccounting";
import { useState } from "react";

import { AppShell } from "@/components/tx/AppShell";
import { EChart } from "@/components/tx/EChart";
import { ExoticTrioPools } from "@/components/tx/ExoticTrioPools";
import { SinglePoolDaily } from "@/components/tx/SinglePoolDaily";
import { OfficialRaceAudit } from '@/components/tx/OfficialRaceAudit';

import { Card, Disclaimer, Empty, ErrorNote, Loading, PageHead, Scroller, Seg, Table, Td } from "@/components/tx/ui";
import { fmtMeetingDate } from "@/lib/tx-api";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/strategy-pnl")({
  head: () => ({
    meta: [
      { title: "天喜策略累計盈虧紀錄 · 天喜 TIANXI" },
      {
        name: "description",
        content:
          "天喜 TX-Oracle 模型策略累計盈虧透明紀錄：每場以 $10/注複式箱形（四連環／單T／三重彩／四重彩）投注模型首 4，逐日彙總成本、派彩與累計盈虧。純分析紀錄，非投注建議。",
      },
      { property: "og:title", content: "天喜策略累計盈虧紀錄 · 天喜 TIANXI" },
      { property: "og:description", content: "逐日彙總成本、派彩與累計盈虧，蝕都照列。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <FeaturePageGate min="pro" title="策略盈虧"><StrategyPnlPage /></FeaturePageGate>,
});

const VENUE: Record<string, string> = { ST: "沙田", HV: "跑馬地" };

const POOLS: { key: string; nm: string; en: string; unit: string }[] = [
  { key: "FF", nm: "四連環", en: "F4 · 任序首4", unit: "$10" },
  { key: "TRIO", nm: "單T", en: "TRIO · 任序首3", unit: "$40" },
  { key: "TIERCE", nm: "三重彩", en: "TIERCE · 依序首3", unit: "$240" },
  { key: "QUARTET", nm: "四重彩", en: "QUARTET · 依序首4", unit: "$240" },
  { key: "DT", nm: "孖T", en: "二拖三 · 跨兩場", unit: "$90" },
  { key: "TT", nm: "三T", en: "二拖三 · 跨三場", unit: "$270" },
];

function money(v?: number | null) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 1 })}`;
}
function signed(v?: number | null) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 1 })}`;
}
const tone = (v?: number | null) => ((Number(v) || 0) >= 0 ? "text-win" : "text-lose");

/** 累計盈虧走勢：ECharts 折線＋面積（0 線分界）；顏色讀設計 token，跟全站主題 */
function CumChart({ points }: { points: { date: string; cum: number }[] }) {
  if (points.length < 2) return <Empty label="需要至少兩個賽馬日才畫走勢" />;
  const css = (name: string, fallback: string) =>
    (typeof window !== "undefined" && getComputedStyle(document.documentElement).getPropertyValue(name).trim()) || fallback;
  const win = css("--win", "#1a7f4b");
  const lose = css("--lose", "#b3341f");
  const ink3 = css("--ink-3", "#8a8a8a");
  const gold = css("--gold", "#b8860b");
  const vals = points.map((p) => Number(p.cum) || 0);
  const last = vals[vals.length - 1] ?? 0;
  const lineColor = last >= 0 ? win : lose;

  const option: import("echarts").EChartsOption = {
    animationDuration: 500,
    grid: { left: 8, right: 10, top: 14, bottom: 22, containLabel: true },
    tooltip: {
      trigger: "axis",
      valueFormatter: (v) => `${Number(v) >= 0 ? "+" : "-"}$${Math.abs(Number(v)).toLocaleString("en-US")}`,
      textStyle: { fontSize: 11 },
    },
    xAxis: {
      type: "category",
      data: points.map((p) => p.date.slice(5)),
      axisLine: { lineStyle: { color: ink3 } },
      axisLabel: { color: ink3, fontSize: 9, fontFamily: "monospace" },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: ink3, opacity: 0.18, type: "dashed" } },
      axisLabel: {
        color: ink3,
        fontSize: 9,
        fontFamily: "monospace",
        formatter: (v: number) => `${v >= 0 ? "+" : "-"}$${Math.abs(v) >= 1000 ? `${(Math.abs(v) / 1000).toFixed(0)}k` : Math.abs(v)}`,
      },
    },
    series: [
      {
        type: "line",
        data: vals,
        smooth: 0.25,
        showSymbol: false,
        lineStyle: { color: lineColor, width: 2 },
        itemStyle: { color: lineColor },
        areaStyle: { color: lineColor, opacity: 0.08 },
        markLine: {
          silent: true,
          symbol: "none",
          data: [{ yAxis: 0 }],
          lineStyle: { color: ink3, type: "dashed", width: 1 },
          label: { show: false },
        },
        markPoint: {
          symbolSize: 7,
          itemStyle: { color: gold },
          label: { show: false },
          data: [{ name: "最近", coord: [vals.length - 1, last] }],
        },
      },
    ],
  };

  return (
    <div>
      <EChart option={option} height={190} ariaLabel="累計盈虧走勢" />
      <div className="tabnum mt-1 flex justify-between px-0.5 font-mono-tx text-[9.5px] text-ink-3">
        <span>{points[0]?.date}</span>
        <span>最近 {signed(last)}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  );
}

function StrategyPnlPage() {
  const [days, setDays] = useState<30 | 90 | 180>(90);
  const [dayPick, setDayPick] = useState("");
  const accounting = useStrategyAccounting(days);
  const { pnl, base, rawPoints, filtered, points, cross, missing, totalCost, totalPayout } = accounting;
  const supplemented = 0;
  const crossLoading = accounting.loading;
  const crossError = !!accounting.error;
  const d = { ...base, totalCost, totalPayout, totalNet: accounting.totalNet, roiPct: accounting.roiPct };
  const fourPool = filtered ? {} : base.poolBreakdown;
  const breakdown: Record<string, any> = { ...fourPool, ...cross };
  const sortedDesc = [...points].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return (
    <AppShell page="engine" ticker="天喜策略累計盈虧 · 蝕都照列">
      <PageHead
        en="Strategy P&L · Cumulative"
        title="天喜策略累計盈虧紀錄"
        desc={
          <>
            由 2026 年 6 月賽事起記錄至今，假設每場以 $10／注：四連環、單T、三重彩及四重彩用引擎預測排序頭 4 選做複式（第 5 選唔計入）；孖T、三T用頭 5 選——第 1、2 選做膽，拖第 3、4、5 選。逐日彙總成本、派彩與累計盈虧。
            <span className="mt-1 block font-mono-tx text-[11px] text-ink-3">純分析紀錄 · 非投注建議 · 賽果來源 HKJC</span>
          </>
        }
      />
      <div className="mx-4 mt-3 rounded-[12px] border border-gold-strong bg-gradient-to-b from-gold-bg to-paper-2 px-3.5 py-3 font-serif-tc text-[11.5px] leading-[1.6] text-ink-2">
        <b className="font-extrabold text-ink">⚠ 此為透明回溯紀錄，並非投注策略。</b>
        每場每池全數落注屬結構性負期望值（−EV），累計線長線預期向下；天喜唔會挑選或修飾數字，蝕都照列。模型強項在於
        <b className="font-extrabold text-ink">頭 4 名箱形覆蓋率</b>，而非逐場捉單頭。
      </div>

      <div className="mx-4 mt-3">
        <Seg
          value={days}
          onChange={setDays}
          options={[
            { value: 30, label: "近 30 日" },
            { value: 90, label: "近 90 日" },
            { value: 180, label: "近半年" },
          ]}
        />
      </div>

      <OfficialRaceAudit accounting meetings={rawPoints} />

      {pnl.isLoading || crossLoading ? (
        <div className="px-4 py-6">
          <Loading size="lg" label="彙總策略盈虧中…" />
          <p className="mx-auto mt-3 max-w-[460px] text-center text-[11.5px] leading-[1.7] text-ink-3">
            首次載入需向 HKJC 逐日彙總多個賽事日嘅箱形派彩，需時較長（約 10–40 秒）；數字準備好會即時顯示走勢圖與逐日紀錄。
          </p>
        </div>
      ) : pnl.error || crossError ? (
        <div className="mx-4 mt-3">
          <ErrorNote error={accounting.error || new Error("跨場彩池未能讀齊，暫不顯示不完整累計，請稍後重試。")} />
          <Button variant="outline" size="sm" className="mt-2" onClick={accounting.retry}>重新核對六彩池</Button>
        </div>
      ) : (
        <>
          {d.pending ? (
            <div className="mx-4 mt-3 flex items-center gap-2 rounded-[10px] border border-hairline bg-paper px-3 py-2.5 font-mono-tx text-[11px] text-ink-3">
              <span className="h-2 w-2 animate-pulse rounded-full bg-gold" />
              尚有 {d.pending} 個賽馬日等待官方派彩回收
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2.5 px-4 pb-1 pt-3.5">
            <div className="col-span-2 rounded-[14px] border border-gold-strong bg-gradient-to-b from-gold-bg to-paper-2 px-3 py-4 text-center">
              <p className="font-mono-tx text-[10px] font-bold tracking-[0.13em] text-ink-3">{missing ? "已可核對累計盈虧" : "累計盈虧"} CUMULATIVE NET</p>
              <p className={`mt-1.5 font-serif-tc text-[40px] font-black leading-none ${tone(d.totalNet)}`}>
                {signed(d.totalNet)}
              </p>
              <p className="mt-1.5 font-serif-tc text-[11px] leading-[1.4] text-ink-3">
                {d.from} → {d.to} · {d.daysEvaluated ?? "—"} 個賽馬日 · {d.racesBet ?? "—"} 場
              </p>
            </div>
            {[
              { l: "回報率 ROI", v: d.roiPct != null ? `${Number(d.roiPct).toFixed(1)}%` : "—", s: "派彩 ÷ 成本 − 1", t: d.roiPct },
              { l: "總成本 COST", v: money(d.totalCost), s: "四個單場彩池＋孖T／三T", t: null },
              { l: "總派彩 PAYOUT", v: money(d.totalPayout), s: "只計中獎彩池", t: null },
              { l: "投注場數 RACES", v: d.racesBet ?? "—", s: "模型有效四揀場次", t: null },
            ].map((k) => (
              <div key={k.l} className="rounded-[14px] border border-hairline bg-paper px-3 py-4 text-center">
                <p className="font-mono-tx text-[10px] font-bold tracking-[0.13em] text-ink-3">{k.l}</p>
                <p
                  className={`mt-1.5 break-all font-serif-tc text-[26px] font-black leading-none ${
                    k.t == null ? "text-ink" : tone(k.t)
                  }`}
                >
                  {k.v}
                </p>
                <p className="mt-1.5 font-serif-tc text-[11px] text-ink-3">{k.s}</p>
              </div>
            ))}
          </div>

          <Card title="累計盈虧走勢" en="Cumulative Curve">
            <CumChart points={points.map((p) => ({ date: p.date, cum: Number(p.cum) || 0 }))} />
          </Card>

          {supplemented || missing ? <p className="mx-4 mt-3 text-[11px] leading-relaxed text-gold">跨場紀錄含 {supplemented} 口賽後補第五選試算；{missing} 口缺預測未計成本／派彩。並非全期賽前凍結實績。</p> : null}

          <Card title="逐個彩池" en="By Pool" action={<Button variant="outline" size="sm" asChild><Link to="/cross-race-pools">跨場明細</Link></Button>}>
            {filtered ? <p className="mb-2 text-[11px] leading-relaxed text-ink-3">後端只提供四個單場彩池嘅全期分池數字，所選時段唔夠全期時暫唔顯示，避免同上面累計對唔上；孖T／三T 按所選時段計。</p> : null}
            <div className="grid grid-cols-2 gap-2">
              {POOLS.map((p) => {
                const b = breakdown[p.key];
                return (
                  <div key={p.key} className="rounded-[11px] border border-hairline bg-paper px-3 py-2.5">
                    <p className="font-serif-tc text-[13px] font-extrabold text-ink">
                      {p.nm}
                      <small className="ml-1.5 font-mono-tx text-[9px] font-semibold tracking-[0.05em] text-ink-3">
                        {p.unit}／{p.key === "DT" || p.key === "TT" ? "口" : "場"}
                      </small>
                    </p>
                    <p className={`mt-1.5 font-serif-tc text-[20px] font-black leading-none ${tone(b?.net)}`}>
                      {signed(b?.net)}
                    </p>
                    <p className="tabnum mt-1.5 font-mono-tx text-[9.5px] tracking-[0.02em] text-ink-3">
                      {p.en}
                      <br />
                      中 {b?.wins ?? "—"}／{b?.bets ?? "—"} {p.key === "DT" || p.key === "TT" ? "口" : "場"}{b?.cons ? `（另 ${b.cons} 口只中安慰獎）` : ""}<br />總成本 {money(b?.cost)}<br />總派彩 {money(b?.payout)}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="逐日紀錄" en="Daily Log">
            {sortedDesc.length ? (
              <Scroller>
                <Table head={["賽日", "場數", "成本", "派彩", "盈虧", "累計"]}>
                  {sortedDesc.map((p: any, i: number) => (
                    <tr key={p.date || i} className="border-b border-hairline">
                      <Td first>
                        <span className="font-serif-tc text-[12px] font-bold">{fmtMeetingDate(p.date)}</span>
                        <small className="block font-mono-tx text-[9px] font-normal text-ink-3">
                          {VENUE[p.venue] || p.venue || ""}
                        </small>
                      </Td>
                      <Td>{p.racesBet ?? "—"}</Td>
                      <Td>{money(p.cost)}</Td>
                      <Td>{money(p.payout)}</Td>
                      <Td className={tone(p.net)}>{signed(p.net)}</Td>
                      <Td className={tone(p.cum)}>{signed(p.cum)}</Td>
                    </tr>
                  ))}
                </Table>
              </Scroller>

            ) : (
              <Empty label="暫無已回收派彩的賽馬日" />
            )}
          </Card>

        </>
      )}

      {sortedDesc.length ? (
        <section className="mx-4 mt-3.5 space-y-3" aria-label="逐場彩池核對">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="pool-day" className="text-[12px] font-bold text-ink">逐場中唔中 · 賽馬日</label>
            <select id="pool-day" value={dayPick || (sortedDesc[0]?.date ?? "")} onChange={(e) => setDayPick(e.target.value)} className="rounded-[6px] border border-hairline bg-paper-2 px-2 py-1 text-[12px] text-ink">
              {sortedDesc.map((p) => <option key={p.date} value={p.date}>{p.date}</option>)}
            </select>
          </div>
          <SinglePoolDaily date={dayPick || (sortedDesc[0]?.date ?? "")} />
          <ExoticTrioPools date={dayPick || (sortedDesc[0]?.date ?? "")} />
          <Button variant="outline" size="sm" asChild><Link to="/cross-race-pools" search={{ date: dayPick || (sortedDesc[0]?.date ?? "") }}>查看當日跨場明細</Link></Button>
        </section>
      ) : null}

      <p className="mx-4 mt-3.5 text-[11px] leading-[1.6] text-ink-3">
        <strong className="text-ink">計算方法：</strong>
        每個已收回 HKJC 結果之賽事日，凡模型於賽前定出有效 4 隻馬之場次，即假設同時投注四連環（任序首 4，1 注 $10）、單T（任序首
        3，4 注 $40）、三重彩（依序首 3，24 注 $240）、四重彩（依序首 4，24 注 $240），每場成本 $530。孖T／三T跨場組口盈虧由19/10/2026起計，之前賽日不計跨場組口；孖T每口9注$90，三T每口27注$270（完整二拖三）。跨場投注按馬會實際開設口數另計，已核實組口的成本及派彩併入累計；缺原始第五選或官方替補證據則待核，不入合計。派彩沿用該場實際 HKJC
        箱形派彩（只記中獎彩池），輸注亦照計成本。起始本金 $0。
        <br />
        逐場預測與賽果可於{" "}
        <Link to="/results" className="text-ink underline">
          預測與賽果
        </Link>{" "}
        查閱；模型命中率見{" "}
        <Link to="/track-record" className="text-ink underline">
          公開戰績
        </Link>
        。
      </p>

      <Disclaimer extra="盈虧以官方派彩及固定注碼假設計算，未扣除任何費用；過往表現不代表未來結果。" />
    </AppShell>
  );
}
