/**
 * /today 賽日儀表板純函式：場次焦點、鎖定狀態、四揀命中、模型 vs 市場差距。
 * 唔改上游資料；展示層用。
 */

export type RaceClockRow = {
  raceNumber: number;
  startTime?: string | null;
  settled?: boolean;
  hasResult?: boolean;
};

export type PickLike = {
  horseNumber?: number | null;
  rank?: number | null;
  pWin?: number | null;
  winOdds?: number | null;
  nameCh?: string | null;
  finishingPosition?: number | null;
};

/** 香港日曆日 YYYY-MM-DD（以 Asia/Hong_Kong 為準）。 */
export function hkCalendarDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isMeetingToday(meetingDate: string | null | undefined, now: Date = new Date()): boolean {
  if (!meetingDate) return false;
  return String(meetingDate).slice(0, 10) === hkCalendarDate(now);
}

/** 解析賽事開跑時間（香港牆鐘）為 epoch ms；無效則 null。 */
export function raceStartMs(
  startTime: string | null | undefined,
  meetingDate: string | null | undefined,
): number | null {
  if (!startTime || !meetingDate) return null;
  const ct = String(startTime).trim();
  const m = ct.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  const d = String(meetingDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m || !d) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3] ?? 0);
  if (hh > 23 || mm > 59 || ss > 59) return null;
  const iso = `${d[1]}-${d[2]}-${d[3]}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}+08:00`;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

export type FocusRace = {
  race: RaceClockRow;
  kind: "current" | "next" | "last";
};

/**
 * 揀「而家」場：開跑後 8 分鐘內當前場；否則下一場；全日完場後最後一場。
 */
export function pickFocusRace(
  races: readonly RaceClockRow[],
  meetingDate: string | null | undefined,
  nowMs: number,
  currentWindowMs = 8 * 60_000,
): FocusRace | null {
  if (!races.length) return null;
  const sorted = [...races].sort((a, b) => Number(a.raceNumber) - Number(b.raceNumber));
  let next: RaceClockRow | null = null;
  let current: RaceClockRow | null = null;
  for (const r of sorted) {
    const start = raceStartMs(r.startTime, meetingDate);
    if (start == null) continue;
    if (r.settled === true || r.hasResult === true) continue;
    if (nowMs < start) {
      next = r;
      break;
    }
    if (nowMs - start <= currentWindowMs) current = r;
  }
  if (current) return { race: current, kind: "current" };
  if (next) return { race: next, kind: "next" };
  const last = sorted[sorted.length - 1];
  return last ? { race: last, kind: "last" } : null;
}

export type LockPhase = "pending" | "draft" | "countdown" | "locked" | "unavailable" | "loading";

export function lockPhase(input: {
  isLoading?: boolean;
  publicationPending?: boolean;
  frozen?: boolean;
  edition?: string | null;
  lockAt?: string | null;
  nowMs?: number;
}): LockPhase {
  if (input.isLoading) return "loading";
  if (input.publicationPending) return "pending";
  if (input.edition === "unavailable") return "unavailable";
  if (input.frozen || input.edition === "final") return "locked";
  const lockMs = input.lockAt ? Date.parse(input.lockAt) : NaN;
  if (Number.isFinite(lockMs) && (input.nowMs ?? Date.now()) < lockMs) return "countdown";
  return "draft";
}

export function lockStatusLabel(phase: LockPhase, lockAt?: string | null, nowMs: number = Date.now()): string {
  switch (phase) {
    case "loading":
      return "核對鎖定狀態…";
    case "pending":
      return "正在建立凍結副本";
    case "unavailable":
      return "預測暫未能核實";
    case "locked":
      return "已鎖";
    case "countdown": {
      const lockMs = lockAt ? Date.parse(lockAt) : NaN;
      if (!Number.isFinite(lockMs)) return "初版 · T−90 倒數";
      const sec = Math.max(0, Math.floor((lockMs - nowMs) / 1000));
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
      return `T−90 倒數 ${pad(h)}:${pad(m)}:${pad(s)}`;
    }
    default:
      return "初版";
  }
}

/** 按 rank 取前 n 選（缺 rank 用陣列次序）。 */
export function rankedPicks<T extends PickLike>(picks: readonly T[] | null | undefined, n = 5): T[] {
  const rows = [...(picks ?? [])];
  rows.sort((a, b) => Number(a.rank ?? 99) - Number(b.rank ?? 99));
  return rows.slice(0, n);
}

/**
 * 模型勝算 vs 除水市場機率差距（百分點）。缺賠率則 null。
 * 市場機率用全場有效獨贏賠率歸一化；只對焦點馬回傳差距。
 */
export function modelMarketGapPp(
  focus: PickLike | null | undefined,
  field: readonly PickLike[] | null | undefined,
): number | null {
  if (!focus || focus.pWin == null || !Number.isFinite(focus.pWin)) return null;
  const odds = (field ?? [])
    .map((p) => (typeof p.winOdds === "number" && p.winOdds > 0 ? 1 / p.winOdds : null))
    .filter((v): v is number => v != null);
  if (odds.length < 2) return null;
  const focusOdds = typeof focus.winOdds === "number" && focus.winOdds > 0 ? 1 / focus.winOdds : null;
  if (focusOdds == null) return null;
  const sum = odds.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return null;
  const market = focusOdds / sum;
  return (focus.pWin - market) * 100;
}

/** 四揀命中數（實際名次 1–4 相交）；資料不足回 null。 */
export function top4HitCount(
  predicted: readonly { horseNumber?: number | null }[] | null | undefined,
  actualTop4: readonly number[] | null | undefined,
): number | null {
  const pred = (predicted ?? [])
    .map((p) => Number(p.horseNumber))
    .filter((n) => Number.isFinite(n))
    .slice(0, 4);
  const actual = (actualTop4 ?? []).filter((n) => Number.isFinite(n));
  if (pred.length < 4 || actual.length < 1) return null;
  const set = new Set(actual);
  return pred.filter((n) => set.has(n)).length;
}

/** 由 picks 嘅 finishingPosition 推實際頭四（有齊先計）。 */
export function actualTop4FromPicks(picks: readonly PickLike[] | null | undefined): number[] | null {
  const placed = (picks ?? [])
    .filter((p) => typeof p.finishingPosition === "number" && p.finishingPosition! >= 1 && p.finishingPosition! <= 4)
    .sort((a, b) => Number(a.finishingPosition) - Number(b.finishingPosition));
  if (placed.length < 4) return null;
  return placed.slice(0, 4).map((p) => Number(p.horseNumber));
}

export function venueLabel(venue?: string | null): string {
  if (venue === "HV") return "跑馬地";
  if (venue === "ST") return "沙田";
  return venue || "—";
}

export const RACE_DAY_NAV_LABEL = "賽日";
export const RACE_DAY_PAGE_TITLE = "賽日";
export const PRELIMINARY_UNLOCKED_LABEL = "初版.未鎖";
export const DAY_HITS_EMPTY = "每一場完結並核實後即顯示該場命中；未完場唔預估。";
export const DAY_HITS_PARTIAL = "已核實場次先計入；未完場唔預估。";
export const STRATEGY_PNL_CARD_TITLE = "策略累計盈虧";
/** 今日卡只加總策略 API 嘅四個單場彩池；孖T／三T 喺詳情頁另計，呢度唔估。 */
export const STRATEGY_PNL_NOTE = "單場四個彩池累計（孖T／三T 喺詳情按已核實組口另計）· 非投資建議";
export const DISTANCE_PENDING = "途程待公布";
export const GOING_PENDING = "地況待公布";
export const CLASS_PENDING = "班次待公布";

/** 焦點卡標題：`28/10/26 18:45HKT 沙田馬場`。日期、開跑、馬場都係傳入值。 */
export function focusRaceHeading(input: {
  date?: string | null | undefined;
  startTime?: string | null | undefined;
  venueName?: string | null | undefined;
}): string {
  const d = String(input.date ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dateLabel = d ? `${d[3]}/${d[2]}/${d[1]!.slice(2)}` : "日期待定";
  const clock = String(input.startTime ?? "").trim().match(/^(\d{1,2}):(\d{2})/);
  const hh = clock ? Number(clock[1]) : NaN;
  const mm = clock ? Number(clock[2]) : NaN;
  const timeLabel = clock && hh <= 23 && mm <= 59 ? `${String(hh).padStart(2, "0")}:${clock[2]}HKT` : "時間待定";
  return `${dateLabel} ${timeLabel} ${venueRacecourse(input.venueName)}`;
}

export function venueRacecourse(name?: string | null): string {
  const n = String(name ?? "").trim();
  if (!n || n === "—") return "馬場待定";
  return n.endsWith("馬場") ? n : `${n}馬場`;
}

export function positiveDistance(race: { distance?: unknown; distanceM?: unknown } | null | undefined): number | null {
  for (const value of [race?.distance, race?.distanceM]) {
    const n = typeof value === "number" ? value : typeof value === "string" && /^\d{3,4}$/.test(value.trim()) ? Number(value.trim()) : NaN;
    if (Number.isInteger(n) && n >= 800 && n <= 4000) return n;
  }
  return null;
}

export function distanceText(meters: number | null | undefined): string {
  return meters != null ? `${meters}米` : DISTANCE_PENDING;
}

export function goingText(going: string | null | undefined): string | null {
  const g = String(going ?? "").trim();
  if (!g || g === "—" || g === "-" || g === "–") return null;
  return g;
}

export function goingPill(going: string | null | undefined): string {
  const g = goingText(going);
  return g ? `地況 ${g}` : GOING_PENDING;
}

export function classDistanceLine(className: string | null | undefined, meters: number | null | undefined): string {
  const klass = String(className ?? "").trim();
  return `${klass || CLASS_PENDING} · ${distanceText(meters)}`;
}

export type RaceRunStatus = "完場" | "進行中" | "待開";

/** 有已核實命中先當完場；未核實唔靠開跑倒數預估命中。 */
export function raceRunStatus(input: {
  settled?: boolean;
  hasResult?: boolean;
  hitCount?: number | null;
  countdownLabel?: string | null;
}): RaceRunStatus {
  if (input.settled === true || input.hasResult === true || typeof input.hitCount === "number") return "完場";
  if (input.countdownLabel === "已開跑") return "進行中";
  return "待開";
}

/** 只喺初版仍未鎖、而且該場未開跑時標「初版.未鎖」。凍結、進行中、完場唔再標。 */
export function showPreliminaryUnlocked(phase: LockPhase, status: RaceRunStatus): boolean {
  if (status !== "待開") return false;
  return phase === "draft" || phase === "countdown";
}

/**
 * 逐場命中：會籍被隱藏嘅場次唔顯示。
 * hit-rate 有數字就用；否則用凍結投影嘅 verifiedHitCount。兩者都冇就唔估。
 */
export function displayedRaceHit(input: {
  redactedByHitRate?: boolean;
  hitRateCount?: number | null | undefined;
  verifiedHitCount?: number | null | undefined;
}): number | null {
  if (input.redactedByHitRate) return null;
  if (typeof input.hitRateCount === "number") return input.hitRateCount;
  if (typeof input.verifiedHitCount === "number") return input.verifiedHitCount;
  return null;
}

/** 累計只加已核實場次。未有命中嘅場唔入分母，唔使等全日完。 */
export function sumVerifiedHits(counts: readonly (number | null | undefined)[]): { hits: number; racesCounted: number } {
  let hits = 0;
  let racesCounted = 0;
  for (const value of counts) {
    if (typeof value === "number") {
      hits += value;
      racesCounted += 1;
    }
  }
  return { hits, racesCounted };
}

export type LabTool = {
  key: string;
  title: string;
  en: string;
  blurb: string;
  status: "soon" | "locked" | "ready";
  href?: string;
};

/** 功能頁工具位外殼（P1；回測、比較器、走位節奏、彩池優化器已下架）。 */
export const LAB_TOOLS: readonly LabTool[] = [
  {
    key: "h2h",
    title: "馬匹或騎師數據獨立比較",
    en: "Independent comparison",
    blurb: "分開比較兩匹馬或兩位騎師；留第二批（需 Worker API）。",
    status: "soon",
  },
  {
    key: "going",
    title: "場地天氣",
    en: "Going & weather",
    blurb: "場地／天氣研究工具；本批未實作。",
    status: "soon",
  },
] as const;
