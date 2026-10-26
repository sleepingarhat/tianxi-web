import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/tx/AppShell";
import { FeaturePageGate } from "@/components/tx/gates/FeaturePageGate";
import {
  Card,
  Disclaimer,
  ErrorNote,
  PageHead,
  Pill,
  Stat,
  StatGrid,
} from "@/components/tx/ui";
import { Button } from "@/components/ui/button";
import { optimizeLabPools, type PoolOptimizeResult } from "@/lib/lab-pools.functions";
import {
  POOLS_DISCLAIMER_EXTRA,
  POOLS_PAGE_DESC,
  POOLS_RESEARCH_BANNER,
  parseRaceIdsInput,
} from "@/lib/lab-pools-ui";

type Search = {
  pool?: string;
  budget?: number;
};

export const Route = createFileRoute("/lab/pools")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const out: Search = {};
    if (typeof search["pool"] === "string") out.pool = search["pool"];
    if (typeof search["budget"] === "number" && Number.isFinite(search["budget"])) {
      out.budget = search["budget"];
    } else if (typeof search["budget"] === "string" && /^\d+(\.\d+)?$/.test(search["budget"])) {
      out.budget = Number(search["budget"]);
    }
    return out;
  },
  head: () => ({
    meta: [
      { title: "彩池優化器 · 研究室 · 天喜 TIANXI" },
      {
        name: "description",
        content: "研究層彩池組合優化：凍結 pWin + Harville；唔入公開戰績、無落注連結。",
      },
      { property: "og:title", content: "彩池優化器 · 天喜" },
      { property: "og:description", content: "Pro 研究室 · 研究用・唔係官方建議。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <FeaturePageGate min="pro" title="彩池優化器">
      <PoolsPage />
    </FeaturePageGate>
  ),
});

function PoolsPage() {
  const search = Route.useSearch();
  const [pool, setPool] = useState(search.pool ?? "FF");
  const [method, setMethod] = useState<"top_k" | "banker_box">("top_k");
  const [budget, setBudget] = useState(String(search.budget ?? 100));
  const [raceIdsText, setRaceIdsText] = useState("race_2026-10-25_ST_1");
  const [result, setResult] = useState<PoolOptimizeResult | null>(null);

  const raceIds = useMemo(() => parseRaceIdsInput(raceIdsText), [raceIdsText]);

  const mut = useMutation({
    mutationFn: () =>
      optimizeLabPools({
        data: {
          pool: pool as "FF" | "QUARTET" | "TRIO",
          raceIds,
          budget: Number(budget),
          method,
        },
      }),
    onSuccess: (r) => setResult(r),
  });

  const chart = useMemo(() => {
    if (!result?.combos?.length) return null;
    const maxC = Math.max(...result.combos.map((c) => c.cost), 1);
    const maxP = Math.max(...result.combos.map((c) => c.modelHitProb), 1e-9);
    return result.combos.map((c) => ({
      key: `${c.raceId}-${c.combination}`,
      costPct: (c.cost / maxC) * 100,
      probPct: (c.modelHitProb / maxP) * 100,
      label: c.combination,
    }));
  }, [result]);

  return (
    <AppShell page="lab" columns={false} wide ticker="研究層 · 彩池優化 · 非投注建議">
      {/* 固定、收唔埋研究層橫額 */}
      <div
        role="note"
        className="sticky top-0 z-40 border-b-2 border-lose/50 bg-lose/15 px-4 py-2 text-center text-[12px] font-bold text-ink"
      >
        {POOLS_RESEARCH_BANNER}
      </div>

      <PageHead
        en="Pool optimizer"
        title="彩池組合優化器"
        desc={POOLS_PAGE_DESC}
      />

      <p className="mx-4 text-[11px] leading-relaxed text-ink-3">
        範圍：單場 FF／QUARTET／TRIO（複式或按機率取前 K）。孖T／三T 跨場為 phase-2。
        特徵回測見 <Link to="/features" className="text-gold">/features</Link>。
      </p>

      <Card title="參數" en="Inputs">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[11px] text-ink-3">
            彩池
            <select
              className="mt-1 block w-full rounded-md border border-hairline bg-paper-2 px-2 py-1.5 text-sm text-ink"
              value={pool}
              onChange={(e) => setPool(e.target.value)}
            >
              <option value="FF">FF 四連環（無序）</option>
              <option value="QUARTET">QUARTET 四重彩（有序）</option>
              <option value="TRIO">TRIO 三重彩</option>
            </select>
          </label>
          <label className="block text-[11px] text-ink-3">
            覆蓋方式
            <select
              className="mt-1 block w-full rounded-md border border-hairline bg-paper-2 px-2 py-1.5 text-sm text-ink"
              value={method}
              onChange={(e) => setMethod(e.target.value as "top_k" | "banker_box")}
            >
              <option value="top_k">按機率取前 K 複式</option>
              <option value="banker_box">膽拖（簡化）</option>
            </select>
          </label>
          <label className="block text-[11px] text-ink-3">
            預算（港元單位注）
            <input
              className="mt-1 block w-full rounded-md border border-hairline bg-paper-2 px-2 py-1.5 text-sm text-ink"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className="block text-[11px] text-ink-3 sm:col-span-2">
            場次 raceId（逗號或換行；須已凍結）
            <textarea
              className="mt-1 block w-full rounded-md border border-hairline bg-paper-2 px-2 py-1.5 font-mono-tx text-[11px] text-ink"
              rows={3}
              value={raceIdsText}
              onChange={(e) => setRaceIdsText(e.target.value)}
              placeholder="race_YYYY-MM-DD_ST_1"
            />
          </label>
        </div>
        <Button className="mt-3" disabled={mut.isPending || raceIds.length === 0} onClick={() => mut.mutate()}>
          {mut.isPending ? "計算中…" : "優化（研究）"}
        </Button>
        {mut.isError ? (
          <div className="mt-2">
            <ErrorNote error={mut.error} />
          </div>
        ) : null}
      </Card>

      {result ? (
        <>
          <StatGrid>
            <Stat label="總成本" value={String(result.totalCost)} />
            <Stat label="組合數" value={String(result.combos.length)} />
            <Stat label="模型" value={result.model} />
            <Stat label="範圍" value={result.scope} />
          </StatGrid>

          <Card title="結果" en="Combos" action={<Pill tone="ink">無投注連結</Pill>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-[11px]">
                <thead>
                  <tr className="border-b border-hairline text-ink-3">
                    <th className="py-1 pr-2">場次</th>
                    <th className="py-1 pr-2">組合</th>
                    <th className="py-1 pr-2">注數</th>
                    <th className="py-1 pr-2">成本</th>
                    <th className="py-1">估算命中機率</th>
                  </tr>
                </thead>
                <tbody>
                  {result.combos.map((c) => (
                    <tr key={`${c.raceId}-${c.combination}-${c.note}`} className="border-b border-hairline/50">
                      <td className="py-1.5 pr-2 font-mono-tx text-[10px]">{c.raceId}</td>
                      <td className="py-1.5 pr-2 font-mono-tx">{c.combination}</td>
                      <td className="py-1.5 pr-2">{c.bets}</td>
                      <td className="py-1.5 pr-2">{c.cost}</td>
                      <td className="py-1.5">{(c.modelHitProb * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.warnings.length ? (
              <ul className="mt-2 list-disc pl-4 text-[10px] text-ink-3">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </Card>

          {chart ? (
            <Card title="成本 vs 機率（相對）" en="Cost vs prob">
              <div className="space-y-2">
                {chart.map((row) => (
                  <div key={row.key}>
                    <p className="truncate font-mono-tx text-[10px] text-ink-3">{row.label}</p>
                    <div className="flex h-2 gap-1">
                      <div className="rounded-sm bg-gold/70" style={{ width: `${row.costPct}%` }} title="成本" />
                      <div className="rounded-sm bg-ink/40" style={{ width: `${row.probPct}%` }} title="機率" />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-ink-3">金＝相對成本；灰＝相對模型機率（非賠率）。</p>
            </Card>
          ) : null}

          <p className="mx-4 text-[11px] font-bold text-ink-2">{result.researchBanner}</p>
          <p className="mx-4 text-[11px] text-ink-3">{result.disclaimer}</p>
        </>
      ) : null}

      <Disclaimer extra={POOLS_DISCLAIMER_EXTRA} />
    </AppShell>
  );
}
