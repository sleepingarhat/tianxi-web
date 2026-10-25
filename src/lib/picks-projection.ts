import type { DayPicks, PickRow, RaceRow } from "./racing-shapes";
import type { Tier } from "./tiers";

/**
 * 伺服器端全日預測投影（PRO_ENFORCEMENT=on 先生效），嚴格跟 src/lib/tiers.ts FEATURE_TIERS：
 *
 *   cards.race1 = guest        → 第一場：所有人睇到揀選表
 *   cards.all_races = pro      → 其他場次完整揀選：只限 Pro
 *   cards.other_top1 /
 *   race.picks_top1 = registered → 其他場次：登入會員只得首選一匹（馬號／名），訪客乜都冇
 *   explain.postrace /
 *   reconcile.full = registered → 已完賽場次：登入會員完整揀選；訪客冇
 *   engine.deep = registered   → 因子分解、LGB 分數、模型版本等：訪客一律剝走
 *   poolodds.value = pro       → value／valueEdge：非 Pro 一律剝走
 *
 * 用「允許清單」（allow-list）而唔係「刪除清單」，上游新增欄位唔會自動洩漏俾非 Pro。
 * 純函數，唔會改動原本（可能被快取共用）嘅物件。Pro 原樣返回。
 */

/** 任何非 Pro 都唔可以見嘅揀選欄位（poolodds.value = pro）。 */
const PRO_ONLY_PICK_FIELDS = ["value", "valueEdge"] as const;

/** 訪客喺第一場可見嘅揀選欄位（cards.race1 = guest；唔包 engine.deep）。 */
const GUEST_PICK_FIELDS = [
  "horseNumber",
  "horseId",
  "id",
  "nameCh",
  "nameEn",
  "jockeyCh",
  "trainerCh",
  "draw",
  "pWin",
  "pTop3",
  "pTop4",
  "rank",
  "winOdds",
  "liveWinOdds",
  "weight",
  "declaredWeight",
  "rating",
  "code",
  "silksCode",
  "gear",
  "frozen",
  "finishingPosition",
  "officialChange",
] as const;

/** 登入會員喺「其他場次」只得首選一匹嘅欄位（race.picks_top1／cards.other_top1）。 */
const TOP1_PICK_FIELDS = ["rank", "horseNumber", "horseId", "nameCh", "nameEn"] as const;

/** 所有級別都可見嘅場次資料（排位表本身係公開資料，唔含模型輸出）。 */
const RACE_META_FIELDS = [
  "raceNumber",
  "raceId",
  "id",
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
  "officialChange",
] as const;

/** 訪客喺第一場額外可見（cards.tsx 第一場卡片會顯示）；唔包模型版本／覆蓋率等 engine.deep。 */
const GUEST_RACE1_EXTRA_FIELDS = [
  "scoreSource",
  "raceQuality",
  "expectedBoxCoverage",
  "marketReady",
  "oddsSnapshotAt",
] as const;

/** 全日層面所有級別可見嘅欄位。 */
const DAY_PUBLIC_FIELDS = [
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
] as const;

function pick<T extends object>(src: T, keys: readonly string[]): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const k of keys)
    if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = (src as Record<string, unknown>)[k];
  return out as Partial<T>;
}

function omit<T extends object>(src: T, keys: readonly string[]): T {
  const out = { ...src } as Record<string, unknown>;
  for (const k of keys) delete out[k];
  return out as T;
}

export type RaceAccess = "full" | "top1" | "locked";

/** 每場嘅存取級別（Pro 一律 full）。 */
export function raceAccess(tier: Tier, race: RaceRow): RaceAccess {
  if (tier === "pro") return "full";
  const raceOne = Number(race.raceNumber) === 1;
  const finished = race.settled === true || race.hasResult === true;
  if (raceOne) return "full";
  if (tier === "registered") return finished ? "full" : "top1";
  return "locked";
}

function projectRace(race: RaceRow, tier: Tier): RaceRow {
  const picks: PickRow[] = Array.isArray(race.picks) ? race.picks : [];
  const access = raceAccess(tier, race);
  if (access === "locked") return { ...pick(race, RACE_META_FIELDS), picks: [] };
  if (access === "top1") {
    const top = [...picks].sort((a, b) => Number(a.rank ?? 99) - Number(b.rank ?? 99))[0];
    return {
      ...pick(race, RACE_META_FIELDS),
      picks: top ? [pick(top, TOP1_PICK_FIELDS) as PickRow] : [],
    };
  }
  // full
  if (tier === "registered") {
    return { ...race, picks: picks.map((p) => omit(p, PRO_ONLY_PICK_FIELDS)) };
  }
  // guest 第一場：允許清單
  return {
    ...pick(race, [...RACE_META_FIELDS, ...GUEST_RACE1_EXTRA_FIELDS]),
    picks: picks.map((p) => pick(p, GUEST_PICK_FIELDS) as PickRow),
  };
}

export function projectDayPicksForViewer(day: DayPicks, tier: Tier): DayPicks {
  if (tier === "pro" || !day || typeof day !== "object") return day;
  const races: RaceRow[] = Array.isArray(day.races)
    ? day.races.map((r) => projectRace(r, tier))
    : [];
  if (tier === "registered") return { ...day, races };
  // 訪客：engine／meta 屬 engine.deep，只保留 lockAt（cards.tsx 第一場用嚟計退出馬）
  const out: DayPicks = { ...pick(day, DAY_PUBLIC_FIELDS), races };
  const lockAt = day.engine?.lockAt ?? day.meta?.lockAt;
  if (lockAt !== undefined) out.engine = { lockAt };
  return out;
}

export function proEnforcementEnabled(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
  return (env["PRO_ENFORCEMENT"] ?? "").trim().toLowerCase() === "on";
}
