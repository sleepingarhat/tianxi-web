/**
 * 策略比較器前端輔助（研究層）：KPI 列、逐日差異、累計盈虧 EChart。
 */
import type { EChartsOption } from "echarts";
import { LIVE_FROM_DATE, type BacktestSummary, type PoolCode } from "./lab-backtest";

export type CompareStrategyKind = "official" | "elo" | "custom";

export type CompareSeriesPoint = {
  date: string;
  races: number;
  avgTop4Hits: number;
  cost: number;
  payout: number;
  net: number;
  cum: number;
  phase: "live" | "backtest";
};

export type CompareStrategyColumn = {
  key: string;
  label: string;
  kind: CompareStrategyKind;
  summary: BacktestSummary & { maxLosingStreakDays?: number | null };
  series: CompareSeriesPoint[];
  liveFrom?: string;
};

export type CompareDayDiffRow = {
  date: string;
  phase: "live" | "backtest";
  nets: Record<string, number>;
  cums: Record<string, number>;
  maxGap: number | null;
  maxGapKeys: [string, string] | null;
};

export type ComparePayload = {
  status: "ready";
  from: string;
  to: string;
  pools: PoolCode[];
  strategies: CompareStrategyColumn[];
  dayDiff: CompareDayDiffRow[];
  researchNote: string;
  matrixVersion: string;
  matrixSource: string;
  limitations: string[];
  liveFrom: string;
};

export type KpiRow = {
  id: string;
  label: string;
  format: "num" | "pct" | "money" | "raw";
  values: Record<string, number | string | null>;
};

export function seriesPhase(date: string): "live" | "backtest" {
  return date >= LIVE_FROM_DATE ? "live" : "backtest";
}

/** KPI 對照表列（行＝指標，列＝策略）。 */
export function buildKpiRows(strategies: CompareStrategyColumn[]): KpiRow[] {
  const keys = strategies.map((s) => s.key);
  const cell = (pick: (s: CompareStrategyColumn) => number | string | null): Record<string, number | string | null> => {
    const out: Record<string, number | string | null> = {};
    for (const s of strategies) out[s.key] = pick(s);
    return out;
  };

  const poolCodes = new Set<PoolCode>();
  for (const s of strategies) {
    for (const p of Object.keys(s.summary.poolHits ?? {}) as PoolCode[]) poolCodes.add(p);
  }

  const rows: KpiRow[] = [
    {
      id: "avgTop4Hits",
      label: "四揀平均命中",
      format: "num",
      values: cell((s) => s.summary.avgTop4Hits),
    },
  ];

  for (const pool of ["FF", "TRIO", "TIERCE", "QUARTET"] as PoolCode[]) {
    if (!poolCodes.has(pool) && !strategies.some((s) => s.summary.poolHits?.[pool])) continue;
    rows.push({
      id: `hit_${pool}`,
      label: `${pool} 命中率%`,
      format: "pct",
      values: cell((s) => s.summary.poolHits?.[pool]?.rate ?? null),
    });
  }

  rows.push(
    {
      id: "cost",
      label: "成本",
      format: "money",
      values: cell((s) => (s.summary.showRoi ? s.summary.cost : null)),
    },
    {
      id: "net",
      label: "淨盈虧",
      format: "money",
      values: cell((s) => (s.summary.showRoi ? s.summary.net : null)),
    },
    {
      id: "roi",
      label: "ROI%",
      format: "pct",
      values: cell((s) => (s.summary.showRoi ? s.summary.roiPct : null)),
    },
    {
      id: "dd",
      label: "最大回撤",
      format: "money",
      values: cell((s) => (s.summary.showRoi ? s.summary.maxDrawdown : null)),
    },
    {
      id: "loseStreak",
      label: "最長連輸賽日",
      format: "num",
      values: cell((s) => s.summary.maxLosingStreakDays ?? null),
    },
    {
      id: "races",
      label: "樣本場數",
      format: "num",
      values: cell((s) => s.summary.raceCount),
    },
  );

  // ensure keys present even if empty strategies
  void keys;
  return rows;
}

/** 標出 cum 差距最大嘅賽日（若有）。 */
export function findMaxGapDay(dayDiff: CompareDayDiffRow[]): CompareDayDiffRow | null {
  let best: CompareDayDiffRow | null = null;
  for (const d of dayDiff) {
    if (d.maxGap == null) continue;
    if (!best || (best.maxGap ?? -1) < d.maxGap) best = d;
  }
  return best;
}

const COLORS = ["#B8860B", "#3D5A80", "#1a7f4b", "#b3341f"];

/** 多策略累計盈虧線；2026-10-04 前可用虛線（若 ECharts 支援 per-point 難，改用 markLine）。 */
export function buildCompareCumOption(strategies: CompareStrategyColumn[]): EChartsOption {
  const dates = new Set<string>();
  for (const s of strategies) for (const p of s.series) dates.add(p.date);
  const x = [...dates].sort();

  const series = strategies.map((s, i) => {
    const map = new Map(s.series.map((p) => [p.date, p.cum]));
    return {
      name: s.label,
      type: "line" as const,
      showSymbol: false,
      data: x.map((d) => map.get(d) ?? null),
      lineStyle: {
        width: 2,
        // 整體線型：若全段都係 backtest 用虛線；跨 live 用實線 + markLine
        type: s.series.every((p) => p.phase === "backtest") ? ("dashed" as const) : ("solid" as const),
        color: COLORS[i % COLORS.length],
      },
      itemStyle: { color: COLORS[i % COLORS.length] },
    };
  });

  const markLineData =
    x.some((d) => d >= LIVE_FROM_DATE) && x.some((d) => d < LIVE_FROM_DATE)
      ? [{ xAxis: LIVE_FROM_DATE, name: "實盤起" }]
      : [];

  const seriesOpt = series.map((s, idx) => {
    if (idx === 0 && markLineData.length) {
      return {
        ...s,
        markLine: {
          symbol: "none" as const,
          label: { formatter: "實盤 {c}", fontSize: 10 },
          lineStyle: { type: "dashed" as const, color: "#8a8a8a" },
          data: markLineData,
        },
      };
    }
    return s;
  });

  // EChartsOption 喺 exactOptionalPropertyTypes 下 series 可選；用 as 收斂
  return {
    color: COLORS,
    grid: { left: 48, right: 16, top: 36, bottom: 28 },
    legend: { data: strategies.map((s) => s.label), top: 0, textStyle: { fontSize: 11 } },
    tooltip: { trigger: "axis" as const },
    xAxis: { type: "category" as const, data: x, axisLabel: { fontSize: 10 } },
    yAxis: { type: "value" as const, scale: true, axisLabel: { fontSize: 10 } },
    series: seriesOpt,
  } as EChartsOption;
}

export function formatKpiValue(
  format: KpiRow["format"],
  v: number | string | null | undefined,
): string {
  if (v == null || v === "") return "—";
  if (typeof v === "string") return v;
  if (!Number.isFinite(v)) return "—";
  if (format === "pct") return `${v}`;
  if (format === "money") {
    const n = Number(v);
    return `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 1 })}`;
  }
  return String(v);
}
