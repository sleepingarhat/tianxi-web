import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/tx/AppShell";
import { EChart } from "@/components/tx/EChart";
import { FeaturePageGate } from "@/components/tx/gates/FeaturePageGate";
import {
  Card,
  Disclaimer,
  Empty,
  ErrorNote,
  PageHead,
  Pill,
} from "@/components/tx/ui";
import { Button } from "@/components/ui/button";
import {
  BACKTEST_RANGE_PRESETS,
  LIVE_FROM_DATE,
  listStrategies,
  type PoolCode,
  type SavedStrategy,
} from "@/lib/lab-backtest";
import { runLabCompare } from "@/lib/lab-backtest.functions";
import {
  buildCompareCumOption,
  buildKpiRows,
  findMaxGapDay,
  formatKpiValue,
  type ComparePayload,
} from "@/lib/lab-compare-ui";

type Search = {
  s?: string;
  from?: string;
  to?: string;
  pools?: string;
};

const ALL_POOLS: PoolCode[] = ["FF", "TRIO", "TIERCE", "QUARTET"];

export const Route = createFileRoute("/lab/compare")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const out: Search = {};
    if (typeof search["s"] === "string") out.s = search["s"];
    if (typeof search["from"] === "string") out.from = search["from"];
    if (typeof search["to"] === "string") out.to = search["to"];
    if (typeof search["pools"] === "string") out.pools = search["pools"];
    return out;
  },
  head: () => ({
    meta: [
      { title: "策略比較器 · 研究室 · 天喜 TIANXI" },
      {
        name: "description",
        content:
          "官方四揀／純 Elo／我的策略並列 KPI、累計盈虧同逐日差異（Pro 研究層；唔入公開戰績）。",
      },
      { property: "og:title", content: "策略比較器 · 天喜 TIANXI" },
      { property: "og:description", content: "Pro 研究室策略比較器。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <FeaturePageGate min="pro" title="比較器">
      <ComparePage />
    </FeaturePageGate>
  ),
});

function ComparePage() {
  const search = Route.useSearch();
  const compareFn = useServerFn(runLabCompare);

  const initialPreset =
    BACKTEST_RANGE_PRESETS.find((p) => p.from === search.from && p.to === search.to)?.key ??
    "demo";
  const [preset, setPreset] = useState<(typeof BACKTEST_RANGE_PRESETS)[number]["key"]>(
    initialPreset as (typeof BACKTEST_RANGE_PRESETS)[number]["key"],
  );
  const [pools, setPools] = useState<PoolCode[]>(() => {
    if (search.pools) {
      const parsed = search.pools
        .split(",")
        .map((x: string) => x.trim())
        .filter((p: string): p is PoolCode => (ALL_POOLS as string[]).includes(p));
      if (parsed.length) return parsed;
    }
    return [...ALL_POOLS];
  });

  const [saved, setSaved] = useState<SavedStrategy[]>(() =>
    typeof window !== "undefined" ? listStrategies() : [],
  );
  const [slotC, setSlotC] = useState<string>("");
  const [slotD, setSlotD] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ComparePayload | null>(null);

  const range = BACKTEST_RANGE_PRESETS.find((p) => p.key === preset) ?? BACKTEST_RANGE_PRESETS[2]!;

  const kpiRows = useMemo(
    () => (result ? buildKpiRows(result.strategies) : []),
    [result],
  );
  const chartOpt = useMemo(
    () => (result ? buildCompareCumOption(result.strategies) : null),
    [result],
  );
  const maxGapDay = useMemo(
    () => (result ? findMaxGapDay(result.dayDiff) : null),
    [result],
  );

  function togglePool(p: PoolCode) {
    setPools((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setSaved(listStrategies());
      const strategies: {
        key: string;
        label: string;
        kind: "official" | "elo" | "custom";
        features?: { id: string; weight: number; invert?: boolean }[];
      }[] = [
        { key: "official", label: "官方四揀", kind: "official" },
        { key: "elo", label: "純 Elo", kind: "elo" },
      ];
      const c = listStrategies().find((s) => s.id === slotC);
      const d = listStrategies().find((s) => s.id === slotD);
      if (c) {
        strategies.push({
          key: `c_${c.id}`,
          label: c.name || "我的策略 C",
          kind: "custom",
          features: c.weights.map((w) => ({
            id: w.id,
            weight: w.weight,
            ...(w.invert ? { invert: true } : {}),
          })),
        });
      }
      if (d && d.id !== c?.id) {
        strategies.push({
          key: `d_${d.id}`,
          label: d.name || "我的策略 D",
          kind: "custom",
          features: d.weights.map((w) => ({
            id: w.id,
            weight: w.weight,
            ...(w.invert ? { invert: true } : {}),
          })),
        });
      }
      const payload = (await compareFn({
        data: {
          from: range.from,
          to: range.to,
          pools,
          strategies,
        },
      })) as ComparePayload;
      setResult(payload);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell page="lab" columns={false} wide ticker="比較器 · 研究層 · 非投注建議">
      <PageHead
        en="Strategy comparator"
        title="策略比較器"
        desc={
          <>
            <Link to="/lab" className="text-gold font-bold">
              ← 研究室
            </Link>
            {" · "}
            官方／Elo／我的策略並列 · 實盤起計 {LIVE_FROM_DATE}
          </>
        }
      />

      <Card title="策略槽" en="Slots A–D">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-[12px]">
          <div className="rounded-[4px] border border-hairline bg-paper-2 px-2 py-1.5">
            <div className="font-bold text-ink">A · 官方四揀</div>
            <div className="text-ink-3">固定</div>
          </div>
          <div className="rounded-[4px] border border-hairline bg-paper-2 px-2 py-1.5">
            <div className="font-bold text-ink">B · 純 Elo</div>
            <div className="text-ink-3">固定（矩陣 on-demand）</div>
          </div>
          <label className="rounded-[4px] border border-hairline px-2 py-1.5">
            <div className="font-bold text-ink">C · 我的策略</div>
            <select
              className="mt-1 w-full rounded-md border border-hairline bg-paper px-1 py-1"
              value={slotC}
              onChange={(e) => setSlotC(e.target.value)}
            >
              <option value="">（可空）</option>
              {saved.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="rounded-[4px] border border-hairline px-2 py-1.5">
            <div className="font-bold text-ink">D · 我的策略</div>
            <select
              className="mt-1 w-full rounded-md border border-hairline bg-paper px-1 py-1"
              value={slotD}
              onChange={(e) => setSlotD(e.target.value)}
            >
              <option value="">（可空）</option>
              {saved.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-2 text-[11px] text-ink-3">
          我的策略來自本機 localStorage（
          <Link to="/features" className="text-gold font-bold">
            /features
          </Link>
          儲存）；可空只比官方 vs Elo。
        </p>
      </Card>

      <Card title="期間同彩池" en="Range & pools">
        <div className="flex flex-wrap gap-1.5">
          {BACKTEST_RANGE_PRESETS.map((p) => (
            <Button
              key={p.key}
              type="button"
              variant={preset === p.key ? "default" : "outline"}
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => setPreset(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          {ALL_POOLS.map((p) => (
            <label key={p} className="flex items-center gap-1 text-ink-2">
              <input type="checkbox" checked={pools.includes(p)} onChange={() => togglePool(p)} />
              {p}
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={busy || !pools.length} onClick={() => void run()}>
            {busy ? "比較中…" : "執行比較"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSaved(listStrategies())}
          >
            重新載入本機策略
          </Button>
        </div>
        {error ? (
          <div className="mt-2">
            <ErrorNote error={new Error(error)} />
          </div>
        ) : null}
      </Card>

      {!result && !busy ? (
        <Empty label="揀期間同策略槽後執行比較；示範一句：官方 vs Elo 喺同一窗並列 KPI。" />
      ) : null}

      {result ? (
        <>
          <Card
            title="KPI 對照"
            en="KPI matrix"
            action={
              <Pill tone="ink">
                {result.matrixSource}/{result.matrixVersion}
              </Pill>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[11px]">
                <thead>
                  <tr className="border-b border-hairline text-ink-3">
                    <th className="py-1.5 pr-2 font-bold">指標</th>
                    {result.strategies.map((s) => (
                      <th key={s.key} className="py-1.5 pr-2 font-bold">
                        {s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kpiRows.map((row) => (
                    <tr key={row.id} className="border-b border-hairline/60">
                      <td className="py-1.5 pr-2 text-ink-2">{row.label}</td>
                      {result.strategies.map((s) => (
                        <td key={s.key} className="py-1.5 pr-2 font-mono-tx">
                          {formatKpiValue(row.format, row.values[s.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!result.strategies[0]?.summary.showRoi ? (
              <p className="mt-2 text-[11px] text-ink-3">
                樣本 {'<'} 200 或冇派彩：只出命中，唔出 ROI／盈虧（同回測規則）。
              </p>
            ) : null}
          </Card>

          <Card title="累計盈虧" en="Cumulative PnL">
            {chartOpt && result.strategies.some((s) => s.series.length > 1) ? (
              <EChart option={chartOpt} height={240} ariaLabel="策略累計盈虧比較" />
            ) : (
              <Empty label="系列不足，暫時畫唔到線圖" />
            )}
            <p className="mt-2 text-[10px] text-ink-3">
              {LIVE_FROM_DATE} 起標實盤（markLine）；之前為回測窗。研究層結果唔入公開戰績。
            </p>
          </Card>

          <Card title="逐賽日差異" en="Day diff">
            {maxGapDay ? (
              <p className="mb-2 text-[11px] text-ink-2">
                差距最大日：{" "}
                <span className="font-mono-tx font-bold">{maxGapDay.date}</span>
                {" · "}
                gap {maxGapDay.maxGap ?? "—"}
                {maxGapDay.maxGapKeys
                  ? `（${maxGapDay.maxGapKeys[0]} vs ${maxGapDay.maxGapKeys[1]}）`
                  : ""}
                {" · "}
                <Pill tone={maxGapDay.phase === "live" ? "win" : "ink"}>
                  {maxGapDay.phase === "live" ? "實盤" : "回測"}
                </Pill>
              </p>
            ) : null}
            <div className="max-h-72 overflow-auto">
              <table className="w-full min-w-[640px] text-left text-[11px]">
                <thead>
                  <tr className="border-b border-hairline text-ink-3">
                    <th className="py-1 pr-2">日期</th>
                    <th className="py-1 pr-2">標記</th>
                    {result.strategies.map((s) => (
                      <th key={`n-${s.key}`} className="py-1 pr-2">
                        {s.label} net
                      </th>
                    ))}
                    {result.strategies.map((s) => (
                      <th key={`c-${s.key}`} className="py-1 pr-2">
                        {s.label} cum
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.dayDiff.map((d) => {
                    const highlight =
                      maxGapDay && d.date === maxGapDay.date ? "bg-gold-bg/40" : "";
                    return (
                      <tr key={d.date} className={`border-b border-hairline/50 ${highlight}`}>
                        <td className="py-1 pr-2 font-mono-tx">{d.date}</td>
                        <td className="py-1 pr-2">
                          {d.phase === "live" ? "實盤" : "回測"}
                        </td>
                        {result.strategies.map((s) => (
                          <td key={`n-${s.key}-${d.date}`} className="py-1 pr-2 font-mono-tx">
                            {d.nets[s.key] ?? 0}
                          </td>
                        ))}
                        {result.strategies.map((s) => (
                          <td key={`c-${s.key}-${d.date}`} className="py-1 pr-2 font-mono-tx">
                            {d.cums[s.key] ?? 0}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {result.limitations?.length ? (
            <ul className="mx-4 mt-2 list-disc pl-4 text-[11px] text-ink-2">
              {result.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : null}
          <p className="mx-4 mt-2 text-[11px] text-ink-3">{result.researchNote}</p>
        </>
      ) : null}

      <Disclaimer />
    </AppShell>
  );
}
