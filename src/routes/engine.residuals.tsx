import { FeaturePageGate } from "@/components/tx/gates/FeaturePageGate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AppShell } from "@/components/tx/AppShell";
import { Card, Disclaimer, Empty, ErrorNote, Loading, PageHead, Pill, Scroller, Seg, Stat, StatGrid, Table, Td } from "@/components/tx/ui";
import { TxBar } from "@/components/tx/viz";
import { txApi } from "@/lib/tx-api";

export const Route = createFileRoute("/engine/residuals")({
  head: () => ({
    meta: [
      { title: "殘差診斷 · 天喜 TIANXI 引擎" },
      {
        name: "description",
        content: "按班次、路程、場地狀況、賠率區間與馬場拆開天喜引擎預測與實際結果的偏差，找出系統性高估或低估。",
      },
      { property: "og:title", content: "殘差診斷 · 天喜 TIANXI 引擎" },
      { property: "og:description", content: "預測與實際結果偏差逐組拆解，找出系統性偏差。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <FeaturePageGate min="registered" title="殘差診斷"><ResidualsPage /></FeaturePageGate>,
});

type Row = {
  key: string;
  horses: number;
  races: number;
  predWinPct: number | null;
  actualWinPct: number | null;
  biasWinPp: number | null;
  predTop3Pct: number | null;
  actualTop3Pct: number | null;
  biasTop3Pp: number | null;
  brierWin: number | null;
  bankerHitRate: number | null;
  top4AvgIntersect: number | null;
};

const DIMS = [
  { value: "class", label: "班次" },
  { value: "distance", label: "路程" },
  { value: "going", label: "場地狀況" },
  { value: "oddsBand", label: "賠率區間" },
  { value: "venue", label: "馬場" },
] as const;

type Dim = (typeof DIMS)[number]["value"];

const DIM_LABEL: Record<string, string> = {
  class: "班次",
  distance: "路程",
  going: "場地狀況",
  oddsBand: "賠率區間",
  venue: "馬場",
};

function num(v: number | null | undefined, suffix = "") {
  return v == null ? "—" : `${v}${suffix}`;
}

function BiasCell({ v }: { v: number | null }) {
  if (v == null) return <span className="text-ink-3">—</span>;
  const tone = v > 0 ? "win" : v < 0 ? "lose" : undefined;
  const ratio = Math.min(1, Math.abs(v) / 20);
  return (
    <div className="min-w-0">
      <p className={`tabnum font-mono-tx text-[11px] font-bold ${tone === "win" ? "text-win" : tone === "lose" ? "text-lose" : "text-ink-2"}`}>
        {v > 0 ? "+" : v < 0 ? "−" : ""}
        {Math.abs(v).toFixed(1)}
      </p>
      {tone ? <TxBar ratio={ratio} tone={tone} height={3} className="mt-1" /> : null}
    </div>
  );
}

function ResidualsPage() {
  const [dim, setDim] = useState<Dim>("oddsBand");
  const q = useQuery({ queryKey: ["residuals", 365], queryFn: () => txApi.residuals(365) });
  const rows: Row[] = q.data?.groups?.[dim] ?? [];
  const flagged: { dim: string; key: string; horses: number; biasTop3Pp: number | null; biasWinPp: number | null }[] =
    q.data?.flagged ?? [];

  return (
    <AppShell page="engine" ticker="殘差診斷 · 系統性偏差">
      <PageHead
        en="Residual Diagnostics"
        title="殘差診斷"
        desc="把已對賬嘅凍結預測按班次、路程、場地狀況、賠率區間、馬場拆開，比較「引擎預測機率」同「實際發生率」。正數＝引擎低估（實際好過預測），負數＝高估。"
      />

      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorNote error={q.error} />
      ) : !q.data?.horses ? (
        <Empty label="近 365 日暫無已對賬的凍結預測紀錄" />
      ) : (
        <>
          <Card title="樣本" en="Sample">
            <StatGrid cols={3}>
              <Stat label="對賬匹數" value={q.data.horses} sub="匹" />
              <Stat label="起算日" value={String(q.data.sinceDate ?? "—")} />
              <Stat label="窗口" value={`${q.data.days ?? 365} 日`} />
            </StatGrid>
          </Card>

          <Card title="偏差警示" en="Flagged Bias">
            {flagged.length === 0 ? (
              <p className="text-[11px] text-ink-3">樣本 ≥ 60 匹嘅組別中，冇一組三甲偏差超過 5 個百分點。</p>
            ) : (
              <div className="divide-y divide-hairline">
                {flagged.map((f) => (
                  <div key={`${f.dim}-${f.key}`} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-serif-tc text-[13px] font-bold text-ink">
                        {DIM_LABEL[f.dim] ?? f.dim} · {f.key}
                      </p>
                      <p className="tabnum font-mono-tx text-[10px] text-ink-3">
                        {f.horses} 匹 · 三甲偏差 {num(f.biasTop3Pp)} pp · 獨贏偏差 {num(f.biasWinPp)} pp
                      </p>
                    </div>
                    <Pill tone={(f.biasTop3Pp ?? 0) > 0 ? "win" : "lose"}>
                      {(f.biasTop3Pp ?? 0) > 0 ? "低估" : "高估"}
                    </Pill>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-[10px] leading-relaxed text-ink-3">
              低估＝該組實際上名率高過引擎機率，可以加重；高估＝引擎過度樂觀，應收窄。呢個係診斷結果，未自動改動引擎權重。
            </p>
          </Card>

          <Card title="逐組拆解" en="By Group">
            <div className="mb-2">
              <Seg value={dim} onChange={(v) => setDim(v as Dim)} options={DIMS.map((d) => ({ value: d.value, label: d.label }))} />
            </div>
            {rows.length === 0 ? (
              <Empty label="該分組樣本不足（少於 10 匹）" />
            ) : (
              <Scroller>
                <Table head={["組別", "匹數", "三甲預測", "三甲實際", "三甲偏差", "獨贏偏差", "Brier", "四揀中匹"]}>
                  {rows.map((r) => (
                    <tr key={r.key} className="border-t border-hairline">
                      <Td>
                        <span className="font-serif-tc text-[12px] font-bold text-ink">{r.key}</span>
                      </Td>
                      <Td>{r.horses}</Td>
                      <Td>{num(r.predTop3Pct, "%")}</Td>
                      <Td>{num(r.actualTop3Pct, "%")}</Td>
                      <Td>
                        <BiasCell v={r.biasTop3Pp} />
                      </Td>
                      <Td>
                        <BiasCell v={r.biasWinPp} />
                      </Td>
                      <Td>{num(r.brierWin)}</Td>
                      <Td>{num(r.top4AvgIntersect)}</Td>
                    </tr>
                  ))}
                </Table>
              </Scroller>
            )}
            <p className="mt-2 text-[10px] leading-relaxed text-ink-3">
              偏差單位為百分點（pp）。「四揀中匹」＝該組每場預測首四名之中實際跑入前四嘅平均匹數；賠率區間分組因為逐匹切開，該欄只作參考。
            </p>
          </Card>

          <Card title="更多" en="More">
            <div className="flex gap-3 text-[12px] font-bold text-gold">
              <Link to="/engine/monitor">引擎監控 →</Link>
              <Link to="/engine">引擎頁 →</Link>
            </div>
          </Card>
        </>
      )}

      <Disclaimer />
    </AppShell>
  );
}
