/**
 * 自訂策略／回測前端輔助（研究層）。
 * 策略 CRUD 本批用 localStorage；Supabase migration 見草稿。
 */
import type { FeatureId } from "./race-data";
import type { FeatureWeightSpec } from "./feature-ranking";
export type { FeatureWeightSpec };

export type PoolCode = "FF" | "TRIO" | "TIERCE" | "QUARTET";

export const STRATEGY_STORAGE_KEY = "tianxi.lab.strategies.v1";

export type SavedStrategy = {
  id: string;
  name: string;
  note: string;
  version: number;
  weights: FeatureWeightSpec[];
  pools: PoolCode[];
  createdAt: string;
  updatedAt: string;
  lastBacktestHash?: string;
};

export type BacktestSummary = {
  label: string;
  raceCount: number;
  avgTop4Hits: number;
  poolHits: Partial<Record<PoolCode, { hits: number; bets: number; rate: number }>>;
  cost: number | null;
  payout: number | null;
  net: number | null;
  roiPct: number | null;
  maxDrawdown: number | null;
  showRoi: boolean;
};

export type BacktestResultPayload = {
  hash: string;
  status: "ready";
  params: {
    features: FeatureWeightSpec[];
    from: string;
    to: string;
    pools: PoolCode[];
    valFrom?: string;
  };
  matrixVersion: string;
  matrixSource: string;
  researchNote: string;
  train: BacktestSummary;
  validation: BacktestSummary;
  overall: BacktestSummary;
  officialBaseline: BacktestSummary | null;
  eloBaseline: BacktestSummary | null;
  series: { date: string; cum: number; net: number; races: number }[];
  bySeason: { season: string; summary: BacktestSummary }[];
  computedAt: string;
  limitations: string[];
};

export const WEIGHT_TEMPLATES: {
  key: string;
  label: string;
  weights: FeatureWeightSpec[];
}[] = [
  {
    key: "elo",
    label: "純 Elo（近似）",
    weights: [
      { id: "careerWin", weight: 2 },
      { id: "careerTop3", weight: 1 },
      { id: "form", weight: 1 },
    ],
  },
  {
    key: "draw-dist",
    label: "檔位＋同程",
    weights: [
      { id: "draw", weight: 2 },
      { id: "distance", weight: 2 },
      { id: "distStarts", weight: 1 },
      { id: "form", weight: 1 },
    ],
  },
  {
    key: "form-time",
    label: "狀態＋時間",
    weights: [
      { id: "form", weight: 2 },
      { id: "formTop3", weight: 1.5 },
      { id: "time", weight: 2 },
      { id: "finish", weight: 1 },
    ],
  },
  {
    key: "balanced",
    label: "均衡四揀",
    weights: [
      { id: "h2h", weight: 1 },
      { id: "distance", weight: 1 },
      { id: "draw", weight: 1 },
      { id: "time", weight: 1 },
      { id: "form", weight: 1 },
      { id: "jt", weight: 0.5 },
    ],
  },
];


export function defaultWeights(selected: FeatureId[]): FeatureWeightSpec[] {
  return selected.map((id) => ({ id, weight: 1, invert: false }));
}

export function stepWeight(current: number, delta: number): number {
  const next = Math.round((current + delta) * 2) / 2;
  return Math.max(0, Math.min(3, next));
}

export function loadStrategies(): SavedStrategy[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STRATEGY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStrategies(list: SavedStrategy[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STRATEGY_STORAGE_KEY, JSON.stringify(list));
}

export function upsertStrategy(input: {
  id?: string;
  name: string;
  note?: string;
  weights: FeatureWeightSpec[];
  pools?: PoolCode[];
}): SavedStrategy {
  const list = loadStrategies();
  const now = new Date().toISOString();
  if (input.id) {
    const idx = list.findIndex((s) => s.id === input.id);
    if (idx >= 0) {
      const prev = list[idx];
      const next: SavedStrategy = {
        ...prev,
        name: input.name.trim() || prev.name,
        note: input.note ?? prev.note,
        weights: input.weights,
        pools: input.pools ?? prev.pools,
        version: prev.version + 1,
        updatedAt: now,
      };
      list[idx] = next;
      saveStrategies(list);
      return next;
    }
  }
  const created: SavedStrategy = {
    id: `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: input.name.trim() || "未命名策略",
    note: input.note ?? "",
    version: 1,
    weights: input.weights,
    pools: input.pools ?? ["FF", "TRIO", "TIERCE", "QUARTET"],
    createdAt: now,
    updatedAt: now,
  };
  list.unshift(created);
  saveStrategies(list);
  return created;
}

export function getStrategy(id: string): SavedStrategy | undefined {
  return loadStrategies().find((s) => s.id === id);
}

export function deleteStrategy(id: string): void {
  saveStrategies(loadStrategies().filter((s) => s.id !== id));
}

export const BACKTEST_RANGE_PRESETS = [
  { key: "1q", label: "近 1 季", from: "2025-09-01", to: "2026-10-04" },
  { key: "3q", label: "近 3 季", from: "2024-09-01", to: "2026-10-04" },
  { key: "demo", label: "示範窗", from: "2025-09-07", to: "2026-10-04" },
] as const;
