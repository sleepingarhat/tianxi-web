import type { DayPicks, RaceRow } from "./racing-shapes";
import { FEATURE_TIERS, tierHas, type Tier } from "./tiers";

/**
 * 伺服器端全日預測投影（PRO_ENFORCEMENT=on 先生效）。
 *
 * 原則：每一個級別（訪客 guest／免費會員 registered／Pro）都係由「空物件」開始，
 * 只複製下面允許清單（allow-list）明確列出嘅欄位；巢狀物件／陣列都要有自己嘅清單先會複製。
 * 永遠唔會「由完整物件刪欄位」；上游新增任何欄位（包括巢狀入面）都唔會自動出現喺任何級別。
 * 葉欄位只接受 string／有限 number／boolean／null，上游將葉欄位改成物件都唔會被抄過嚟。
 *
 * 欄位 → 權限（全部由 src/lib/tiers.ts FEATURE_TIERS 推導，唔另設級別）：
 *
 *   場次存取（raceAccess）
 *     第一場                  cards.race1      (guest)       → full
 *     其他場次完整            cards.all_races  (pro)         → full
 *     已完賽場次完整          reconcile.full   (registered)  → full
 *     其他場次首選一匹        cards.other_top1 (registered)  → top1（只得 PICK_TOP1 欄位）
 *     其餘                                                    → locked（只得排位資料，picks: []）
 *
 *   欄位閘（喺 full 場次之內再分）
 *     "card"            場次可見即可見（排位、概率、賠率、退出公告、場次質素）
 *     engine.deep       (registered)  LGB 分數、Elo、模型版本、覆蓋率、alpha、全日引擎資料
 *     explain           未完賽 → explain.prerace (pro)；已完賽 → explain.postrace (registered)
 *                       因子分數 factorBonus／因子分解 factorBreakdown
 *     poolodds.value    (pro)         市場混合／value 欄位：marketProb、marketRank、blendProb、value、valueEdge
 */

type Feature = keyof typeof FEATURE_TIERS;
type Gate = "card" | "explain" | Feature;
type Rule =
  | Gate
  | { readonly gate: Gate; readonly object: Spec }
  | { readonly gate: Gate; readonly array: Spec };
type Spec = Readonly<Record<string, Rule>>;
type Json = Record<string, unknown>;
type Ctx = { tier: Tier; finished: boolean };

const fields = (gate: Gate, keys: readonly string[]): Record<string, Gate> =>
  Object.fromEntries(keys.map((k) => [k, gate]));

/* ---------- 巢狀物件清單 ---------- */

export const OFFICIAL_CHANGE_SPEC: Spec = fields("card", [
  "raceNumber",
  "horseNumber",
  "kind",
  "text",
  "replacement",
  "announcedAt",
  "announcedAtIso",
  "beforeLock",
]);
const FACTOR_CELL_SPEC: Spec = fields("explain", ["bonus", "conf", "note"]);
export const FACTOR_KEYS = ["recency", "distance", "going", "draw", "weight", "condition", "injury", "jtCombo"] as const;
const FACTOR_BREAKDOWN_SPEC: Spec = Object.fromEntries(
  FACTOR_KEYS.map((k) => [k, { gate: "explain", object: FACTOR_CELL_SPEC }]),
);
const RACE_QUALITY_SPEC: Spec = fields("card", ["rank", "total", "tier", "metric", "score"]);
const BOX_COVERAGE_SPEC: Spec = fields("card", ["trio_n4", "trio_n5", "trio_n6", "first4_n4", "first4_n5", "first4_n6"]);
const RACE_LGB_COVERAGE_SPEC: Spec = fields("engine.deep", ["applied", "rows", "hits"]);
const DAY_LGB_COVERAGE_SPEC: Spec = fields("engine.deep", ["rows"]);
const ELO_WEIGHTS_SPEC: Spec = fields("engine.deep", ["horse", "jockey", "trainer"]);
const SEED_SUMMARY_SPEC: Spec = fields("engine.deep", ["ratingSeeded", "classSeeded", "totalSeeded"]);
const PROBABILITY_EVIDENCE_SPEC: Spec = fields("engine.deep", ["pTop4"]);

/* ---------- 揀選（單匹） ---------- */

/** top1 場次：登入會員只得首選一匹嘅身份（race.picks_top1／cards.other_top1）。 */
export const PICK_TOP1_SPEC: Spec = fields("card", ["rank", "horseNumber", "horseId", "nameCh", "nameEn"]);

export const PICK_SPEC: Spec = {
  ...PICK_TOP1_SPEC,
  ...fields("card", [
    "jockeyCh",
    "trainerCh",
    "draw",
    "declaredWeight",
    "weight",
    "rating",
    "code",
    "gear",
    "pWin",
    "pTop3",
    "pTop4",
    "winOdds",
    "liveWinOdds",
    "frozen",
    "finishingPosition",
    "generatedAt",
  ]),
  officialChange: { gate: "card", object: OFFICIAL_CHANGE_SPEC },
  ...fields("engine.deep", [
    "scoreSource",
    "pLgb",
    "lgbScore",
    "lgbModelVersion",
    "modelVersion",
    "ensembleAlpha",
    "finalScore",
    "horseElo",
    "jockeyElo",
    "trainerElo",
    "eloComposite",
    "eloEngine",
  ]),
  factorBonus: "explain",
  factorBreakdown: { gate: "explain", object: FACTOR_BREAKDOWN_SPEC },
  ...fields("poolodds.value", ["marketProb", "marketRank", "blendProb", "value", "valueEdge"]),
};

/* ---------- 場次 ---------- */

/** 所有級別、所有場次都可見嘅排位資料（唔含任何模型輸出）。 */
export const RACE_META_SPEC: Spec = {
  ...fields("card", [
    "raceNumber",
    "raceId",
    "title",
    "startTime",
    "distance",
    "distanceM",
    "className",
    "class",
    "going",
    "course",
    "track",
    "settled",
    "hasResult",
  ]),
  officialChange: { gate: "card", object: OFFICIAL_CHANGE_SPEC },
};

/** full 場次額外欄位。 */
export const RACE_FULL_SPEC: Spec = {
  ...RACE_META_SPEC,
  ...fields("card", ["scoreSource", "marketReady", "oddsSnapshotAt"]),
  raceQuality: { gate: "card", object: RACE_QUALITY_SPEC },
  expectedBoxCoverage: { gate: "card", object: BOX_COVERAGE_SPEC },
  ...fields("engine.deep", ["lgbModelVersion", "ensembleAlpha", "probabilityModel", "marketBeta"]),
  lgbCoverage: { gate: "engine.deep", object: RACE_LGB_COVERAGE_SPEC },
  picks: { gate: "card", array: PICK_SPEC },
};

/* ---------- 全日 ---------- */

export const ENGINE_SPEC: Spec = {
  lockAt: "card",
  ...fields("engine.deep", ["eloEngine", "eloReady", "lgbModelVersion", "computeMs"]),
  eloWeights: { gate: "engine.deep", object: ELO_WEIGHTS_SPEC },
  lgbCoverage: { gate: "engine.deep", object: DAY_LGB_COVERAGE_SPEC },
  probabilityEvidence: { gate: "engine.deep", object: PROBABILITY_EVIDENCE_SPEC },
};

export const DAY_SPEC: Spec = {
  ...fields("card", [
    "date",
    "venue",
    "trackCondition",
    "generatedAt",
    "lockAt",
    "frozen",
    "edition",
    "publicationDeadline",
    "noMeeting",
    "message",
    "eloReady",
  ]),
  // use-today-picks 會用 engine ?? meta ?? 全日物件本身做引擎資料，所以頂層都要逐項列明。
  ...fields("engine.deep", ["scoreSource", "eloEngine", "lgbModelVersion", "computeMs"]),
  eloWeights: { gate: "engine.deep", object: ELO_WEIGHTS_SPEC },
  lgbCoverage: { gate: "engine.deep", object: DAY_LGB_COVERAGE_SPEC },
  seedSummary: { gate: "engine.deep", object: SEED_SUMMARY_SPEC },
  probabilityEvidence: { gate: "engine.deep", object: PROBABILITY_EVIDENCE_SPEC },
  engine: { gate: "card", object: ENGINE_SPEC },
  meta: { gate: "card", object: ENGINE_SPEC },
};

/* ---------- 複製器 ---------- */

function isPlainObject(v: unknown): v is Json {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function isLeaf(v: unknown): boolean {
  return v === null || typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v));
}
function gateOpen(gate: Gate, ctx: Ctx): boolean {
  if (gate === "card") return true;
  if (gate === "explain")
    return tierHas(ctx.tier, FEATURE_TIERS[ctx.finished ? "explain.postrace" : "explain.prerace"]);
  return tierHas(ctx.tier, FEATURE_TIERS[gate]);
}

/** 由空物件開始，只抄 spec 列明而且閘門開咗嘅欄位；巢狀只經自己嘅 spec。 */
export function copyAllowed(src: unknown, spec: Spec, ctx: Ctx): Json {
  const out: Json = {};
  if (!isPlainObject(src)) return out;
  for (const [key, rule] of Object.entries(spec)) {
    if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
    const gate = typeof rule === "string" ? rule : rule.gate;
    if (!gateOpen(gate, ctx)) continue;
    const value = src[key];
    if (typeof rule === "string") {
      if (isLeaf(value)) out[key] = value;
    } else if ("object" in rule) {
      if (value === null) out[key] = null;
      else if (isPlainObject(value)) out[key] = copyAllowed(value, rule.object, ctx);
    } else if (Array.isArray(value)) {
      out[key] = value.filter(isPlainObject).map((item) => copyAllowed(item, rule.array, ctx));
    }
  }
  return out;
}

export type RaceAccess = "full" | "top1" | "locked";

function raceFinished(race: RaceRow): boolean {
  return race.settled === true || race.hasResult === true;
}

/** 每場嘅存取級別，全部由 FEATURE_TIERS 推導。 */
export function raceAccess(tier: Tier, race: RaceRow): RaceAccess {
  if (Number(race.raceNumber) === 1) return tierHas(tier, FEATURE_TIERS["cards.race1"]) ? "full" : "locked";
  if (tierHas(tier, FEATURE_TIERS["cards.all_races"])) return "full";
  if (raceFinished(race) && tierHas(tier, FEATURE_TIERS["reconcile.full"])) return "full";
  if (tierHas(tier, FEATURE_TIERS["cards.other_top1"]) && tierHas(tier, FEATURE_TIERS["race.picks_top1"])) return "top1";
  return "locked";
}

/** 只抄已核實命中數。賽果、原四揀馬號同 officialMetric 本體唔進入投影。 */
function verifiedHitCountForViewer(race: Json, tier: Tier): number | null {
  const row = race as RaceRow;
  if (raceAccess(tier, row) !== "full") return null;
  const metric = race["officialMetric"];
  if (!isPlainObject(metric) || metric["eligible"] !== true) return null;
  const hits = metric["originalHits"];
  if (typeof hits !== "number" || !Number.isInteger(hits) || hits < 0 || hits > 4) return null;
  return hits;
}

function projectRace(race: unknown, tier: Tier): Json | null {
  if (!isPlainObject(race)) return null;
  const row = race as RaceRow;
  const ctx: Ctx = { tier, finished: raceFinished(row) };
  const access = raceAccess(tier, row);
  let out: Json;
  if (access === "full") {
    out = copyAllowed(race, RACE_FULL_SPEC, ctx);
    if (!Array.isArray(out["picks"])) out["picks"] = [];
  } else {
    out = copyAllowed(race, RACE_META_SPEC, ctx);
    if (access === "top1") {
      const picks = (Array.isArray(row.picks) ? row.picks : []).filter(isPlainObject);
      const top = [...picks].sort((a, b) => Number(a["rank"] ?? 99) - Number(b["rank"] ?? 99))[0];
      out["picks"] = top ? [copyAllowed(top, PICK_TOP1_SPEC, ctx)] : [];
    } else {
      out["picks"] = [];
    }
  }
  const hit = verifiedHitCountForViewer(race, tier);
  if (hit != null) out["verifiedHitCount"] = hit;
  return out;
}

/**
 * 按會籍投影全日預測。三個級別都用同一套允許清單，Pro 只係閘門全開，
 * 唔會原樣返回上游物件。純函數，唔改原物件（可能被快取共用）。
 */
export function projectDayPicksForViewer(day: DayPicks, tier: Tier): DayPicks {
  if (!isPlainObject(day)) return { races: [] };
  const out = copyAllowed(day, DAY_SPEC, { tier, finished: false });
  const races = Array.isArray(day.races) ? day.races : [];
  out["races"] = races.map((r) => projectRace(r, tier)).filter((r): r is Json => r !== null);
  return out as DayPicks;
}

export function proEnforcementEnabled(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  return (env["PRO_ENFORCEMENT"] ?? "").trim().toLowerCase() === "on";
}

/* ---------- 單匹鎖定解釋（getLockedEvidence） ---------- */

/** explain.postrace (registered)：已完賽；explain.prerace (pro)：未完賽凍結版。 */
export function lockedEvidenceAllowed(tier: Tier, settled: boolean): boolean {
  return tierHas(tier, FEATURE_TIERS[settled ? "explain.postrace" : "explain.prerace"]);
}

export const LOCKED_EVIDENCE_SPEC: Spec = fields("card", [
  "horseElo",
  "jockeyElo",
  "trainerElo",
  "factorScores",
  "eloComposite",
  "factorBonus",
  "finalScore",
  "generatedAt",
  "modelVersion",
  "rank",
  "source",
  "sire",
  "dam",
  "damsire",
  "pedigreeUpdatedAt",
  "provenance",
]);

/** 只抄允許清單嘅葉欄位（呼叫前已按 lockedEvidenceAllowed 核實級別）。 */
export function projectLockedEvidence<T extends object>(row: T, tier: Tier): T {
  return copyAllowed(row, LOCKED_EVIDENCE_SPEC, { tier, finished: true }) as T;
}
