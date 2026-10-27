/**
 * 自訂策略／回測前端輔助（研究層）。
 * Pro 登入：Supabase user_strategies；未登入／失敗：localStorage fallback。
 * 本機→雲端需明示 migrate（唔 silent 丟資料）。
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
  maxLosingStreakDays?: number | null;
  showRoi: boolean;
};

/** 後端 demo-fixture／demo-v1 或 API demo=true → UI 必須橫幅隱藏 ROI */
export function isDemoMatrixSource(
  matrixSource?: string | null,
  matrixVersion?: string | null,
  demoFlag?: boolean | null,
): boolean {
  if (demoFlag === true) return true;
  const src = (matrixSource ?? "").toLowerCase();
  const ver = (matrixVersion ?? "").toLowerCase();
  return (
    src.includes("demo") ||
    src === "demo-fixture" ||
    ver === "demo-v1" ||
    ver.startsWith("demo-")
  );
}

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
  demo?: boolean;
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

/** 別名：比較器下拉用 */
export function listStrategies(): SavedStrategy[] {
  return loadStrategies();
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
      if (!prev) {
        throw new Error(`strategy index ${idx} missing`);
      }
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

export const LIVE_FROM_DATE = '2026-10-04' as const;

export const BACKTEST_RANGE_PRESETS = [
  { key: "1q", label: "近 1 季", from: "2025-09-01", to: "2026-10-04" },
  { key: "3q", label: "近 3 季", from: "2024-09-01", to: "2026-10-04" },
  { key: "demo", label: "示範窗", from: "2025-09-07", to: "2026-10-04" },
] as const;

/** 雲端列 → SavedStrategy（weights／pools 由 versions 或嵌套帶上） */
const FEATURE_ID_SET = new Set<string>([
  "h2h",
  "distance",
  "draw",
  "time",
  "finish",
  "jt",
  "form",
  "track",
  "rest",
  "weight",
  "careerWin",
  "careerTop3",
  "distStarts",
  "drawStarts",
  "comboTop3",
  "formSlope",
  "formTop3",
  "weightAvg5",
  "goingTop3",
]);

/** 將雲端／本機權重正規化成 FeatureWeightSpec（過濾非法 FeatureId；exactOptional 相容）。 */
export function sanitizeFeatureWeights(raw: unknown): FeatureWeightSpec[] {
  if (!Array.isArray(raw)) return [];
  const out: FeatureWeightSpec[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = (item as { id?: unknown }).id;
    const weight = Number((item as { weight?: unknown }).weight);
    if (typeof id !== "string" || !FEATURE_ID_SET.has(id) || !Number.isFinite(weight)) continue;
    const spec: FeatureWeightSpec = { id: id as FeatureId, weight };
    if ((item as { invert?: unknown }).invert === true) spec.invert = true;
    out.push(spec);
  }
  return out;
}

export function mapCloudStrategyRow(row: {
  id: string;
  name: string;
  note?: string | null;
  current_version?: number | null;
  pools?: string[] | null;
  created_at: string;
  updated_at: string;
  last_backtest_hash?: string | null;
  weights?: FeatureWeightSpec[] | null | unknown;
}): SavedStrategy {
  const pools = (row.pools ?? ["FF", "TRIO", "TIERCE", "QUARTET"]).filter(
    (p): p is PoolCode => p === "FF" || p === "TRIO" || p === "TIERCE" || p === "QUARTET",
  );
  const result: SavedStrategy = {
    id: row.id,
    name: row.name,
    note: row.note ?? "",
    version: row.current_version ?? 1,
    weights: sanitizeFeatureWeights(row.weights),
    pools: pools.length ? pools : ["FF", "TRIO", "TIERCE", "QUARTET"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.last_backtest_hash) result.lastBacktestHash = row.last_backtest_hash;
  return result;
}

export type LocalToCloudPlan = {
  local: SavedStrategy[];
  /** 建議 upsert 嘅本機策略（全部；呼叫端決定 skip 已存在名稱） */
  toUpsert: SavedStrategy[];
};

/** 計劃本機 → 雲端遷移（純函式；唔寫 storage／唔打 API） */
export function planLocalStrategiesMigration(
  local: SavedStrategy[],
  cloudNames: Set<string> = new Set(),
): LocalToCloudPlan {
  const toUpsert = local.filter((s) => s.name.trim() && !cloudNames.has(s.name.trim()));
  return { local, toUpsert };
}

export const STRATEGY_STORAGE_BACKEND = {
  local: "localStorage",
  cloud: "supabase",
} as const;
