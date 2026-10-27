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
