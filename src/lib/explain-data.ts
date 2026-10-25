// 解釋層（唯讀）：只讀凍結四揀同實際頭 4 嘅重疊統計，唔重算排名、唔寫 prediction_log。
// 現階段資料來自倉庫內 JSON；日後改接 GET /api/explain/global 同 GET /api/explain/meeting?date=。

import globalJson from "@/data/explain/global-stratified.json";
import meetingsJson from "@/data/explain/latest-meetings.json";
import catalogJson from "@/data/explain/feature-catalog.json";

export type ExactlyBucket = { count: number; rate: number };

export type OverlapStats = {
  n: number;
  avgOverlap: number;
  exactly: Record<string, ExactlyBucket>;
};

export type LayerStats = {
  n: number;
  overlap: OverlapStats;
  sixupLegRate: number | null;
  qinBox3Rate: number | null;
  qplBox3Rate: number | null;
  placeHitsPerTop3: number | null;
};

export type ExplainLayer = {
  id: string;
  label: string;
  filter?: string;
  stats: LayerStats;
};

export type ResidualBucket = {
  n: number;
  byVenue: Record<string, number>;
  byBand: Record<string, number>;
};

export type ExplainGlobal = {
  schemaVersion: number;
  kind: string;
  disclaimer: string;
  engine: string;
  source: string;
  window: { from: string; to: string; meetings: number; races: number };
  generatedAt: string;
  headlineOverlap: OverlapStats;
  layers: ExplainLayer[];
  residual: { overlap_le_1: ResidualBucket; overlap_ge_3: ResidualBucket };
};

/** 日後由引擎倉喺同一版凍結 booster 跑 TreeSHAP 寫入；冇就留空，唔造假。 */
export type ShapFactor = { feature: string; labelZh?: string | null; sign: number; value: number };

export type ExplainPick = {
  rank: number;
  horseNumber: number | null;
  nameCh: string | null;
  horseId: string | null;
  hitTop4: boolean;
  pWin: number | null;
  reason: string | null;
  scoreSource: string | null;
  shapTop5?: ShapFactor[] | null;
};

export type ExplainActual = {
  position: number;
  horseNumber: number | null;
  nameCh: string | null;
  horseId: string | null;
  winOdds: number | null;
  inPicks: boolean;
};

export type ExplainRace = {
  date: string;
  venue: string | null;
  raceNumber: number;
  distance: number | null;
  going: string | null;
  band: string | null;
  overlap4: number | null;
  src: string | null;
  sixup_leg: boolean | null;
  qin3: boolean | null;
  qpl3: boolean | null;
  place3_hits: number | null;
  picks: ExplainPick[];
  actualTop4: ExplainActual[];
};

export type ExplainMeeting = {
  date: string;
  venue: string | null;
  races: ExplainRace[];
  /** 訪客隱藏場次（只有賽果，唔計命中）。 */
  redacted?: { race: number; actual: number[] }[];
};

export const EXPLAIN_GLOBAL = globalJson as unknown as ExplainGlobal;
export const EXPLAIN_MEETINGS = (meetingsJson as unknown as { meetings: ExplainMeeting[] }).meetings;
export const FEATURE_LABELS = new Map<string, string>(
  (catalogJson as unknown as { features: { id: string; lovableLabel?: string; labelZh: string }[] }).features.map(
    (f) => [f.id, f.lovableLabel ?? f.labelZh],
  ),
);

export function explainMeeting(date: string): ExplainMeeting | undefined {
  return EXPLAIN_MEETINGS.find((m) => m.date === date);
}

export const EXPLAIN_DATES = EXPLAIN_MEETINGS.map((m) => m.date);

export const VENUE_ZH: Record<string, string> = { ST: "沙田", HV: "跑馬地" };

export function pct(x: number | null | undefined, digits = 1): string {
  if (x == null || !isFinite(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

export function fixed(x: number | null | undefined, digits = 2): string {
  if (x == null || !isFinite(x)) return "—";
  return x.toFixed(digits);
}
