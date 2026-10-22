// 天喜 TIANXI · shared API client (ported from tianxi-site /assets/api.js)
import { horseDisplayDto } from './horse-name';
import { timeoutSignal } from "./fetch-timeout";
export const TX_BASE = "https://tianxi-backend.tianxi-entertainment.workers.dev";

/** 預設唔設限時（保持原有行為）；傳 timeoutMs 時逾時即中止，避免頁面無限「載入中」。 */
async function j<T = any>(path: string, timeoutMs?: number): Promise<T> {
  const r = await fetch(TX_BASE + path, {
    credentials: "omit",
    ...(timeoutMs ? { signal: timeoutSignal(timeoutMs) } : {}),
  });
  if (!r.ok) throw new Error(`API ${r.status} ${path}`);
  return horseDisplayDto((await r.json()) as T);
}

async function jp<T = any>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(TX_BASE + path, {
    method: "POST",
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || `API ${r.status}`);
  return data as T;
}

/* ---------- types (loose: backend fields evolve) ---------- */
export type Meeting = {
  id: string;
  date: string;
  venue: string;
  venueName: string;
  trackCondition: string | null;
  weather: string | null;
  totalRaces: number;
  mode?: string;
  isEntryListOnly?: boolean;
  fallback?: boolean;
  races?: RaceSummary[];
};

export type RaceSummary = {
  id: string;
  raceNumber: number;
  title?: string | null;
  class?: string | null;
  className?: string | null;
  distance?: number | null;
  distanceM?: number | null;
  going?: string | null;
  track?: string | null;
  course?: string | null;
  prize?: string | null;
  startTime?: string | null;
  videoUrl?: string | null;
  horses?: RaceHorse[];
};

export type RaceHorse = {
  id: string;
  horseNumber: number;
  name?: string;
  nameCh?: string;
  code?: string;
  draw?: number | null;
  jockey?: string | null;
  jockeyCh?: string | null;
  trainer?: string | null;
  trainerCh?: string | null;
  finishingPosition?: number | null;
  finishTime?: number | string | null;
  winOdds?: number | null;
  runningPosition?: string | null;
  lbw?: string | null;
  gear?: string | null;
  weight?: number | null;
  declaredWeight?: number | null;
  rating?: number | null;
  age?: number | null;
  silksCode?: string | null;
};

export type Pick = {
  horseNumber: number;
  nameCh?: string;
  nameEn?: string;
  jockeyCh?: string | null;
  trainerCh?: string | null;
  draw?: number | null;
  pWin?: number | null;
  pTop3?: number | null;
  pTop4?: number | null;
  rank?: number;
  winOdds?: number | null;
  horseId?: string;
  scoreSource?: string;
  frozen?: boolean;
  declaredWeight?: number | null;
  rating?: number | null;
};

/* ---------- formatters ---------- */
export function cleanTime(t: unknown): string | null {
  if (!t) return null;
  let s = typeof t === "string" ? t : String(t);
  if (s.indexOf("(") === 0 || s.indexOf(" ") !== -1) return null;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) return s.slice(0, 5);
  return null;
}

const p2 = (x: number) => (x < 10 ? "0" : "") + x;

export function countdown(startTime?: string | null, refDate?: Date, meetingDate?: string | null) {
  const ct = cleanTime(startTime);
  if (!ct) return "";
  const parts = ct.split(":").map(Number);
  const hh = parts[0] ?? 0;
  const mm = parts[1] ?? 0;
  const now = refDate || new Date();
  const md = meetingDate ? String(meetingDate).match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  // Official race times are Hong Kong wall-clock times, never browser-local.
  const hkDate = md?.[0] ?? new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
  const tgt = new Date(`${hkDate}T${p2(hh)}:${p2(mm)}:00+08:00`);
  if (!Number.isFinite(tgt.getTime()) || hh > 23 || mm > 59) return "";
  const diff = Math.floor((tgt.getTime() - now.getTime()) / 1000);
  if (diff < 0) return "已開跑";
  if (diff >= 86400) {
    const dd = Math.floor(diff / 86400);
    return `${dd}日 ${p2(Math.floor((diff % 86400) / 3600))}:${p2(Math.floor((diff % 3600) / 60))}`;
  }
  return `${p2(Math.floor(diff / 3600))}:${p2(Math.floor((diff % 3600) / 60))}:${p2(diff % 60)}`;
}

export function fmtDateShort(iso?: string | null) {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[2]!}-${m[3]!}` : iso;
}

const CN_WD = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

export function fmtMeetingDate(iso?: string | null) {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  const wd = isNaN(d.getTime()) ? "" : (CN_WD[d.getUTCDay()] ?? "");
  return `${m[3]!}/${m[2]!}/${m[1]!} ${wd}`;
}

export function silksUrl(code?: string | null) {
  if (!code) return "";
  return silksHdUrl(code) || `${TX_BASE}/api/silks/${encodeURIComponent(code)}.gif`;
}

/** 後備：後端代理的細 GIF */
export function silksGifUrl(code?: string | null) {
  if (!code) return "";
  return `${TX_BASE}/api/silks/${encodeURIComponent(code)}.gif`;
}

/** 馬會官方高清綵衣（透明 PNG） */
export function silksHdUrl(code?: string | null) {
  const c = String(code || "").trim().toUpperCase();
  if (!/^[A-Z]\d{2,4}$/.test(c)) return "";
  return `https://consvc.hkjc.com/-/media/General/Racing/Horse/${c[0]}/${c}/silk_${c}.png`;
}

/** 由 horse_L129 / L129 推導綵衣代碼 */
export function silksCodeOf(source: {
  silksCode?: string | null;
  code?: string | null;
  horseId?: string | null;
  id?: string | null;
}) {
  const raw =
    source.silksCode ||
    source.code ||
    String(source.horseId || source.id || "").replace(/^horse_/, "");
  const code = String(raw || "").trim().toUpperCase();
  return /^[A-Z]\d{2,4}$/.test(code) ? code : "";
}

// 有馬就有綵衣（回傳高清 PNG）
export function silksFor(source: { silksCode?: string | null; code?: string | null; horseId?: string | null; id?: string | null }) {
  return silksHdUrl(silksCodeOf(source));
}



export function canonicalHorseId(value: unknown) {
  const id = value == null ? "" : String(value).trim();
  return /^horse_[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id) ? id : "";
}

export function canonicalRaceId(value: unknown) {
  const id = value == null ? "" : String(value).trim();
  const m = id.match(/^race_(\d{4})-(\d{2})-(\d{2})_(?:ST|HV)_\d+$/);
  if (!m) return "";
  const y = +m[1]!, mo = +m[2]!, d = +m[3]!;
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? id : "";
}

export function finishTime(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "number" && isFinite(value)) return value.toFixed(2);
  const text = String(value).trim();
  if (!text || /^(?:null|undefined|n\/a|na)$/i.test(text)) return "";
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text).toFixed(2);
  const hk = text.match(/^(\d+)[.:](\d{2})[.:](\d{2})$/);
  if (hk) {
    const mins = +hk[1]!, secs = +hk[2]!, hun = +hk[3]!;
    return secs < 60 && hun < 100 ? (mins * 60 + secs + hun / 100).toFixed(2) : "";
  }
  const mn = text.match(/^(\d+):(\d{2})(?:\.(\d+))?$/);
  if (mn) {
    const mins = +mn[1]!, secs = +mn[2]!, frac = mn[3] ? Number("0." + mn[3]) : 0;
    return secs < 60 ? (mins * 60 + secs + frac).toFixed(2) : "";
  }
  return "";
}

export function pct(v?: number | null, digits = 1) {
  if (v == null || !isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

/** 後端 hit-rate rollup 嘅命中率已經係百分比數值（例如 85.7 代表 85.7%），不可再乘 100。 */
export function pctRate(v?: number | null, digits = 1) {
  if (v == null || !isFinite(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

export function num(v?: number | null, digits = 1) {
  if (v == null || !isFinite(v)) return "—";
  return v.toFixed(digits);
}

/* ---------- endpoints ---------- */
export const txApi = {
  base: TX_BASE,
  meetings: (q = "", timeoutMs?: number) =>
    j<{ meetings: Meeting[] }>("/api/meetings" + q, timeoutMs),
  meeting: (date: string, timeoutMs?: number) =>
    j<Meeting>("/api/meetings/" + encodeURIComponent(date), timeoutMs),
  meetingsByMonth: (ym: string) =>
    j<{ meetings: Meeting[] }>(`/api/meetings?month=${encodeURIComponent(ym)}&limit=100`),
  smartCurrent: () => j<Meeting>("/api/meetings/smart/current"),
  nextMeeting: () => j<Meeting>("/api/meetings/next"),
  race: (id: string, timeoutMs?: number) =>
    j<any>("/api/races/" + encodeURIComponent(id), timeoutMs),
  raceEntries: (id: string) => j<any>(`/api/races/${encodeURIComponent(id)}/entries`),
  horses: (q = "") => j<any>("/api/horses" + q),
  horse: (id: string) => j<any>("/api/horses/" + encodeURIComponent(id)),
  horseDetail: (id: string) => j<any>(`/api/horses/${encodeURIComponent(id)}/detail`),
  horseResearch: (id: string, options: Record<string, unknown> = {}) => {
    const qs = Object.keys(options)
      .filter((k) => options[k] != null && options[k] !== "")
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(options[k]))}`)
      .join("&");
    return j<any>(`/api/horses/${encodeURIComponent(id)}/research${qs ? "?" + qs : ""}`);
  },
  horseForm: (id: string, limit = 10) =>
    j<any>(`/api/horses/${encodeURIComponent(id)}/form?limit=${limit}`),
  horseSearch: (q: string) => j<any>("/api/horses/search/query?q=" + encodeURIComponent(q)),
  horseLeaderboard: (by = "elo", limit = 10, status = "all") =>
    j<any>(
      `/api/horses/leaderboard?by=${encodeURIComponent(by)}&limit=${limit}&status=${encodeURIComponent(status)}`,
    ),
  runningStyles: (horseIds: string[], context: { raceId?: string; beforeDate?: string } = {}) => {
    const ids = Array.from(new Set(horseIds.map(canonicalHorseId).filter(Boolean))).sort();
    if (!ids.length) return Promise.resolve({ cutoffDate: "", styles: [] as NonNullable<import('./racing-shapes').RunningStylesResponse['styles']> });
    let qs = "horseIds=" + encodeURIComponent(ids.join(","));
    const raceId = canonicalRaceId(context.raceId);
    if (raceId) qs += "&raceId=" + encodeURIComponent(raceId);
    else if (/^\d{4}-\d{2}-\d{2}$/.test(String(context.beforeDate || "")))
      qs += "&beforeDate=" + encodeURIComponent(String(context.beforeDate));
    return j<any>("/api/horses/running-styles?" + qs).catch(() => ({ cutoffDate: "", styles: [] }));
  },
  jockeys: () => j<any>("/api/jockeys"),
  trainers: () => j<any>("/api/trainers"),
  topPicks: (raceId: string, timeoutMs?: number) =>
    j<any>("/api/analyze/top-picks?raceId=" + encodeURIComponent(raceId), timeoutMs),
  hitRate: (date: string, timeoutMs?: number) =>
    j<any>("/api/analyze/hit-rate?date=" + encodeURIComponent(date), timeoutMs),
  hitRateRollup: (days = 90, timeoutMs?: number) =>
    j<any>("/api/analyze/hit-rate-rollup?days=" + days, timeoutMs),
  predictionAccuracy: (days = 365) => j<any>("/api/analyze/prediction-accuracy?days=" + days),
  calibration: () => j<any>("/api/analyze/calibration"),
  residuals: (days = 365) => j<any>("/api/analyze/residuals?days=" + days),
  predictionLock: (date: string) =>
    j<any>("/api/analyze/prediction-lock?date=" + encodeURIComponent(date)),
  todayPicks: (venue?: string) =>
    j<any>("/api/analyze/today-picks" + (venue ? "?venue=" + encodeURIComponent(venue) : "")),
  strategyPnl: (q = "") => j<any>("/api/analyze/strategy-pnl" + q),
  explain: (raceId: string, horseId: string) =>
    j<any>(
      `/api/analyze/explain?raceId=${encodeURIComponent(raceId)}&horseId=${encodeURIComponent(horseId)}`,
    ),
  odds: (date: string, venue: string, raceNo: number) =>
    j<any>(`/api/odds/${encodeURIComponent(date)}/${encodeURIComponent(venue)}/${raceNo}`),
  analyze: (body: unknown) => jp<any>("/api/analyze", body),
};

/* ---------- running style badge helper ---------- */
export type RunningStyle = { code?: string; label?: string; sampleCount?: number };

export function styleLabel(entry?: RunningStyle | null) {
  if (!entry || !entry.label || !/^(?:放|前|中|後)$/.test(String(entry.label))) return "";
  return String(entry.label);
}
