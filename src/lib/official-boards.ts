/**
 * 已收錄嘅馬會官方顯示。只讀公開 Worker，唔爬馬會，唔當名次，亦唔入預測。
 * 缺表時接口回 available:false、rows:[]。日期或馬場唔啱會 400，所以呼叫前先核對。
 */
import { TX_BASE } from "./tx-api";

export const OFFICIAL_COPY_NOTE = "官方顯示，唔係賽果名次，亦唔會用作預測。";
export const BOARD_PAGE_SIZE = 40;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SEASON = /^20\d{2}-20\d{2}$/;
const BRAND = /^[A-Z]\d{3,4}$/;
const PHOTO = /^https:\/\/consvc\.hkjc\.com\/-\/media\/Sites\/JCRW\/FinishPhotos\/[A-Za-z0-9_./%-]+\.jpe?g$/i;

export const MEETING_BOARDS = [
  { id: "ove-record", label: "賽日獸醫檢查", en: "Meeting veterinary list" },
  { id: "conghua-movement", label: "從化往來", en: "Conghua movement" },
  { id: "jt-combo", label: "騎練合作", en: "Jockey and trainer" },
  { id: "fwb-declared", label: "已申報特別獎金", en: "Declared bonus" },
  { id: "finish-photos", label: "終點照片", en: "Finish photos" },
  { id: "challenge-odds", label: "騎師王／練馬師王賠率", en: "Challenge odds" },
  { id: "racecard-profile", label: "排位馬匹資料", en: "Racecard profile" },
  { id: "racecard-files", label: "排位檔案及跑道圖", en: "Racecard files" },
] as const;

export const DIRECTORY_BOARDS = [
  { id: "ove-database", label: "獸醫檢查名單", en: "Veterinary list" },
  { id: "ppo-performance", label: "自購馬往績", en: "PPO notes" },
  { id: "horse-former-name", label: "馬匹曾用名", en: "Former name" },
  { id: "special-index", label: "特別註解", en: "Special index" },
  { id: "stats-centre", label: "賽日數據", en: "Stats centre" },
  { id: "horse-ratings", label: "馬匹評分", en: "Horse ratings" },
  { id: "horse-news", label: "馬匹消息", en: "Horse news" },
  { id: "import-policy", label: "進口資格", en: "Import criteria" },
] as const;

export type RatingBoard = "clas" | "csum" | "tp50";
export type PolicyPage = "pps" | "ppgs";
const NEWS_VIEW = /^(?:Horses|List)\/[A-Za-z0-9_]{1,40}$/;

export function asRatingBoard(value: unknown): RatingBoard | null {
  return value === "clas" || value === "csum" || value === "tp50" ? value : null;
}

export function asPolicyPage(value: unknown): PolicyPage | null {
  return value === "pps" || value === "ppgs" ? value : null;
}

export type MeetingBoardId = (typeof MEETING_BOARDS)[number]["id"];
export type DirectoryBoardId = (typeof DIRECTORY_BOARDS)[number]["id"];
export type BoardId = MeetingBoardId | DirectoryBoardId;

export type OfficialScope = "meeting" | "directory";
export type VenueCode = "ST" | "HV";

const MEETING_IDS = new Set<string>(MEETING_BOARDS.map((board) => board.id));
const DIRECTORY_IDS = new Set<string>(DIRECTORY_BOARDS.map((board) => board.id));

export function isMeetingBoard(value: string): value is MeetingBoardId {
  return MEETING_IDS.has(value);
}

export function isDirectoryBoard(value: string): value is DirectoryBoardId {
  return DIRECTORY_IDS.has(value);
}

export function asVenue(value: unknown): VenueCode | null {
  return value === "ST" || value === "HV" ? value : null;
}

export function asDate(value: unknown): string | null {
  return typeof value === "string" && DATE.test(value) ? value : null;
}

/** 單字母烙號，例如 J313、K444。兩字母舊烙號接口會拒絕。 */
export function asLocalBrand(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const brand = value.trim().toUpperCase();
  return BRAND.test(brand) ? brand : null;
}

export type BoardQuery = {
  date?: string | null;
  venue?: string | null;
  raceNo?: number | null;
  section?: string | null;
  pool?: string | null;
  brand?: string | null;
  season?: string | null;
  asOf?: string | null;
  /** 馬匹評分必填：clas 評分榜、csum 評分變動、tp50 最高評分。 */
  ratingBoard?: string | null;
  /** 馬匹消息可選分類，例如 List/bres。 */
  newsView?: string | null;
  /** 進口資格可選分頁。 */
  policyPage?: string | null;
};

function queryString(pairs: [string, string][]): string {
  if (!pairs.length) return "";
  return `?${pairs.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&")}`;
}

function meetingPair(query: BoardQuery): { date: string; venue: VenueCode } | null {
  const date = asDate(query.date);
  const venue = asVenue(query.venue);
  if (!date || !venue) return null;
  return { date, venue };
}

function raceNoParam(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 15) return null;
  return String(value);
}

/** 參數未齊或會令接口回 400 時回 null，呼叫方唔好發請求。 */
export function officialBoardPath(board: BoardId, query: BoardQuery = {}): string | null {
  if (board === "special-index") return "/api/official/special-index";
  if (board === "stats-centre") return "/api/official/stats-centre";
  if (board === "horse-ratings") {
    const rating = asRatingBoard(query.ratingBoard);
    return rating ? `/api/official/horse-ratings?board=${rating}` : null;
  }
  if (board === "horse-news") {
    if (query.newsView == null || query.newsView === "") return "/api/official/horse-news";
    return NEWS_VIEW.test(query.newsView) ? `/api/official/horse-news?view=${query.newsView}` : null;
  }
  if (board === "import-policy") {
    if (query.policyPage == null || query.policyPage === "") return "/api/official/import-policy";
    const page = asPolicyPage(query.policyPage);
    return page ? `/api/official/import-policy?page=${page}` : null;
  }
  if (board === "ove-database") {
    const asOf = asDate(query.asOf);
    return `/api/official/ove-database${queryString(asOf ? [["asOf", asOf]] : [])}`;
  }
  if (board === "ppo-performance") {
    const pairs: [string, string][] = [];
    const season = typeof query.season === "string" && SEASON.test(query.season) ? query.season : null;
    const brand = asLocalBrand(query.brand);
    if (season) pairs.push(["season", season]);
    if (brand) pairs.push(["brand", brand]);
    return `/api/official/ppo-performance${queryString(pairs)}`;
  }
  if (board === "horse-former-name") {
    if (query.brand == null || query.brand === "") return "/api/official/horse-former-name";
    const brand = asLocalBrand(query.brand);
    return brand ? `/api/official/horse-former-name?brand=${encodeURIComponent(brand)}` : null;
  }
  const meeting = meetingPair(query);
  if (!meeting) return null;
  const base: [string, string][] = [["date", meeting.date], ["venue", meeting.venue]];
  if (board === "ove-record") return `/api/official/ove-record${queryString(base)}`;
  if (board === "conghua-movement") return `/api/official/conghua-movement${queryString(base)}`;
  if (board === "fwb-declared") return `/api/official/fwb-declared${queryString(base)}`;
  if (board === "racecard-profile") return `/api/official/racecard-profile${queryString(base)}`;
  if (board === "racecard-files") return `/api/official/racecard-files${queryString(base)}`;
  if (board === "jt-combo") {
    const section = query.section === "combo" || query.section === "debut" ? query.section : null;
    return `/api/official/jt-combo${queryString(section ? [...base, ["section", section]] : base)}`;
  }
  if (board === "finish-photos") {
    const raceNo = raceNoParam(query.raceNo);
    return `/api/official/finish-photos${queryString(raceNo ? [...base, ["raceNo", raceNo]] : base)}`;
  }
  if (board === "challenge-odds") {
    const pool = query.pool === "jkc" || query.pool === "tnc" ? query.pool : null;
    return `/api/official/challenge-odds${queryString(pool ? [["pool", pool], ...base] : base)}`;
  }
  return null;
}

export type OfficialEnvelope = {
  available: boolean;
  rows: unknown[];
  source: string;
  date: string | null;
  venue: string | null;
  asOf: string | null;
  brand: string | null;
  season: string | null;
  section: string | null;
  pool: string | null;
  raceNo: number | null;
};

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text : null;
}

function intField(value: unknown, min: number, max: number): number | null {
  const n = typeof value === "number"
    ? value
    : typeof value === "string" && /^-?\d+$/.test(value.trim())
      ? Number(value.trim())
      : NaN;
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}

/** available 唔係 true 時丢掉 rows，避免把缺表當成有紀錄。 */
export function readEnvelope(payload: unknown): OfficialEnvelope | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const source = payload as Record<string, unknown>;
  if (typeof source["available"] !== "boolean") return null;
  const available = source["available"] === true;
  const rawRows = source["rows"];
  return {
    available,
    rows: available && Array.isArray(rawRows) ? rawRows : [],
    source: textOrNull(source["source"]) ?? "",
    date: asDate(source["date"]),
    venue: asVenue(source["venue"]),
    asOf: asDate(source["asOf"]),
    brand: textOrNull(source["brand"]),
    season: textOrNull(source["season"]),
    section: textOrNull(source["section"]),
    pool: source["pool"] === "jkc" || source["pool"] === "tnc" ? source["pool"] : null,
    raceNo: intField(source["raceNo"], 1, 15),
  };
}

export class OfficialBoardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfficialBoardError";
  }
}

export async function fetchOfficialBoard(path: string): Promise<OfficialEnvelope> {
  const response = await fetch(TX_BASE + path, { credentials: "omit" });
  if (response.status === 400) throw new OfficialBoardError("日期、馬場、烙號或分頁唔正確。");
  if (!response.ok) throw new OfficialBoardError("暫時讀唔到官方資料。");
  const payload: unknown = await response.json();
  const envelope = readEnvelope(payload);
  if (!envelope) throw new OfficialBoardError("暫時讀唔到官方資料。");
  return envelope;
}

type Row = Record<string, unknown>;

function asRow(value: unknown): Row | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : null;
}

function displayFlag(row: Row): boolean {
  return row["notRaceResult"] === true;
}

export type SpecialIndexRow = { code: string; lineNo: number; noteCh: string; notRaceResult: boolean };
export type OveRow = {
  lineNo: number | null;
  raceNo: number | null;
  horseNo: number | null;
  reserve: boolean;
  horseCode: string | null;
  horseName: string;
  injuryDate: string | null;
  detail: string;
  passedDate: string | null;
  notRaceResult: boolean;
};
export type ConghuaRow = {
  raceNo: number;
  horseNo: number | null;
  reserve: boolean;
  horseNameCh: string;
  horseNameEn: string | null;
  arrivedDate: string | null;
  returnedDate: string | null;
  notRaceResult: boolean;
};
export type JtRow = {
  section: "combo" | "debut";
  raceNo: number;
  horseNo: number | null;
  horseName: string | null;
  importType: string | null;
  trainerName: string | null;
  winRate: string | null;
  placeRate: string | null;
  asOfText: string | null;
  notRaceResult: boolean;
};
export type FwbRow = {
  raceNo: number;
  horseNo: number | null;
  reserve: boolean;
  horseNameCh: string;
  horseNameEn: string | null;
  brand: string | null;
  bonusCh: string;
  bonusEn: string | null;
  notRaceResult: boolean;
};
export type FinishPhotoRow = {
  raceNo: number;
  photoCode: string;
  seasonCode: string | null;
  imagePath: string;
  notRaceResult: boolean;
};
export type ChallengeRow = {
  pool: "jkc" | "tnc";
  winnerCode: string;
  winnerName: string;
  points: number | null;
  raceNo: number;
  oddsText: string;
  chartUpdatedAt: string | null;
  notRaceResult: boolean;
};
export type FormerNameRow = {
  horseId: string | null;
  brand: string;
  nameEn: string | null;
  nameCh: string;
  formerName: string | null;
  sire: string | null;
  dam: string | null;
  importTypeCh: string | null;
  originCh: string | null;
  age: number | null;
  foalingDate: string | null;
  notRaceResult: boolean;
};
export type PpoRow = {
  season: string;
  brand: string;
  horseNameCh: string;
  formerName: string | null;
  notes: string;
  showPlay: boolean;
  seasonEnabled: boolean;
  notRaceResult: boolean;
};

export function readSpecialIndex(envelope: OfficialEnvelope): SpecialIndexRow[] {
  return envelope.rows.flatMap((value) => {
    const row = asRow(value);
    if (!row) return [];
    const code = textOrNull(row["code"]);
    const noteCh = textOrNull(row["noteCh"]);
    const lineNo = intField(row["lineNo"], 1, 999);
    if (!code || !noteCh || lineNo == null) return [];
    return [{ code, lineNo, noteCh, notRaceResult: displayFlag(row) }];
  });
}

export function readOveRows(envelope: OfficialEnvelope): OveRow[] {
  return envelope.rows.flatMap((value) => {
    const row = asRow(value);
    if (!row) return [];
    const horseName = textOrNull(row["horseName"]);
    const detail = textOrNull(row["detail"]);
    if (!horseName || !detail) return [];
    return [{
      lineNo: intField(row["lineNo"], 1, 9999),
      raceNo: intField(row["raceNo"], 1, 15),
      horseNo: intField(row["horseNo"], 1, 20),
      reserve: row["reserve"] === true,
      horseCode: textOrNull(row["horseCode"]),
      horseName,
      injuryDate: asDate(row["injuryDate"]),
      detail,
      passedDate: asDate(row["passedDate"]),
      notRaceResult: displayFlag(row),
    }];
  });
}

export function readConghuaRows(envelope: OfficialEnvelope): ConghuaRow[] {
  return envelope.rows.flatMap((value) => {
    const row = asRow(value);
    if (!row) return [];
    const raceNo = intField(row["raceNo"], 1, 15);
    const horseNameCh = textOrNull(row["horseNameCh"]);
    if (raceNo == null || !horseNameCh) return [];
    return [{
      raceNo,
      horseNo: intField(row["horseNo"], 1, 20),
      reserve: row["reserve"] === true,
      horseNameCh,
      horseNameEn: textOrNull(row["horseNameEn"]),
      arrivedDate: asDate(row["arrivedDate"]),
      returnedDate: asDate(row["returnedDate"]),
      notRaceResult: displayFlag(row),
    }];
  });
}

export function readJtRows(envelope: OfficialEnvelope): JtRow[] {
  return envelope.rows.flatMap((value) => {
    const row = asRow(value);
    if (!row) return [];
    const section = row["section"] === "combo" || row["section"] === "debut" ? row["section"] : null;
    const raceNo = intField(row["raceNo"], 1, 15);
    if (!section || raceNo == null) return [];
    return [{
      section,
      raceNo,
      horseNo: intField(row["horseNo"], 1, 20),
      horseName: textOrNull(row["horseName"]),
      importType: textOrNull(row["importType"]),
      trainerName: textOrNull(row["trainerName"]),
      winRate: textOrNull(row["winRate"]),
      placeRate: textOrNull(row["placeRate"]),
      asOfText: textOrNull(row["asOfText"]),
      notRaceResult: displayFlag(row),
    }];
  });
}

export function readFwbRows(envelope: OfficialEnvelope): FwbRow[] {
  return envelope.rows.flatMap((value) => {
    const row = asRow(value);
    if (!row) return [];
    const raceNo = intField(row["raceNo"], 1, 15);
    const horseNameCh = textOrNull(row["horseNameCh"]);
    const bonusCh = textOrNull(row["bonusCh"]);
    if (raceNo == null || !horseNameCh || !bonusCh) return [];
    return [{
      raceNo,
      horseNo: intField(row["horseNo"], 1, 20),
      reserve: row["reserve"] === true,
      horseNameCh,
      horseNameEn: textOrNull(row["horseNameEn"]),
      brand: textOrNull(row["brand"]),
      bonusCh,
      bonusEn: textOrNull(row["bonusEn"]),
      notRaceResult: displayFlag(row),
    }];
  });
}

export function finishPhotoUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!PHOTO.test(url) || url.includes("..")) return null;
  return url;
}

export function readFinishPhotos(envelope: OfficialEnvelope): FinishPhotoRow[] {
  return envelope.rows.flatMap((value) => {
    const row = asRow(value);
    if (!row) return [];
    const raceNo = intField(row["raceNo"], 1, 15);
    const imagePath = finishPhotoUrl(row["imagePath"]);
    const photoCode = textOrNull(row["photoCode"]);
    if (raceNo == null || !imagePath || !photoCode) return [];
    return [{
      raceNo,
      photoCode,
      seasonCode: textOrNull(row["seasonCode"]),
      imagePath,
      notRaceResult: displayFlag(row),
    }];
  });
}

export function readChallengeRows(envelope: OfficialEnvelope): ChallengeRow[] {
  return envelope.rows.flatMap((value) => {
    const row = asRow(value);
    if (!row) return [];
    const pool = row["pool"] === "jkc" || row["pool"] === "tnc" ? row["pool"] : null;
    const raceNo = intField(row["raceNo"], 0, 15);
    const winnerName = textOrNull(row["winnerName"]);
    const winnerCode = textOrNull(row["winnerCode"]);
    const oddsText = textOrNull(row["oddsText"]);
    if (!pool || raceNo == null || !winnerName || !winnerCode || !oddsText || !/^\d+(?:\.\d+)?$/.test(oddsText)) return [];
    return [{
      pool,
      winnerCode,
      winnerName,
      points: intField(row["points"], 0, 999),
      raceNo,
      oddsText,
      chartUpdatedAt: textOrNull(row["chartUpdatedAt"]),
      notRaceResult: displayFlag(row),
    }];
  });
}

export function readFormerNames(envelope: OfficialEnvelope): FormerNameRow[] {
  return envelope.rows.flatMap((value) => {
    const row = asRow(value);
    if (!row) return [];
    const brand = textOrNull(row["brand"]);
    const nameCh = textOrNull(row["nameCh"]);
    if (!brand || !nameCh) return [];
    return [{
      horseId: textOrNull(row["horseId"]),
      brand,
      nameEn: textOrNull(row["nameEn"]),
      nameCh,
      formerName: textOrNull(row["formerName"]),
      sire: textOrNull(row["sire"]),
      dam: textOrNull(row["dam"]),
      importTypeCh: textOrNull(row["importTypeCh"]),
      originCh: textOrNull(row["originCh"]),
      age: intField(row["age"], 0, 30),
      foalingDate: asDate(row["foalingDate"]),
      notRaceResult: displayFlag(row),
    }];
  });
}

export function readPpoRows(envelope: OfficialEnvelope): PpoRow[] {
  return envelope.rows.flatMap((value) => {
    const row = asRow(value);
    if (!row) return [];
    const season = textOrNull(row["season"]);
    const brand = textOrNull(row["brand"]);
    const horseNameCh = textOrNull(row["horseNameCh"]);
    if (!season || !brand || !horseNameCh) return [];
    return [{
      season,
      brand,
      horseNameCh,
      formerName: textOrNull(row["formerName"]),
      notes: textOrNull(row["notes"]) ?? "",
      showPlay: row["showPlay"] === true,
      seasonEnabled: row["seasonEnabled"] === true,
      notRaceResult: displayFlag(row),
    }];
  });
}

/** 0 至 1 嘅小數率轉成百分比。唔係呢種寫法就顯示—，唔估。 */
export function formatOfficialRate(value: string | null | undefined): string {
  if (value == null) return "—";
  const text = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) return "—";
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || n > 1) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

/** raceNo 0 係開盤賠率，唔係第 0 場賽果。 */
export function challengeRaceLabel(raceNo: number): string {
  if (!Number.isInteger(raceNo) || raceNo < 0 || raceNo > 15) return "";
  return raceNo === 0 ? "開盤" : `第${raceNo}場`;
}

export function challengePoolLabel(pool: "jkc" | "tnc"): string {
  return pool === "jkc" ? "騎師王" : "練馬師王";
}

export type ChallengePerson = {
  pool: "jkc" | "tnc";
  winnerCode: string;
  winnerName: string;
  points: number | null;
  cells: { raceNo: number; label: string; oddsText: string }[];
};

export function groupChallenge(rows: ChallengeRow[]): { pool: "jkc" | "tnc"; label: string; people: ChallengePerson[] }[] {
  const people = new Map<string, ChallengePerson>();
  for (const row of rows) {
    const key = `${row.pool}:${row.winnerCode}`;
    const person = people.get(key) ?? {
      pool: row.pool,
      winnerCode: row.winnerCode,
      winnerName: row.winnerName,
      points: row.points,
      cells: [],
    };
    if (!person.cells.some((cell) => cell.raceNo === row.raceNo)) {
      person.cells.push({ raceNo: row.raceNo, label: challengeRaceLabel(row.raceNo), oddsText: row.oddsText });
    }
    if (person.points == null) person.points = row.points;
    people.set(key, person);
  }
  const grouped = [...people.values()].map((person) => ({
    ...person,
    cells: [...person.cells].sort((a, b) => a.raceNo - b.raceNo),
  }));
  return (["jkc", "tnc"] as const).flatMap((pool) => {
    const list = grouped.filter((person) => person.pool === pool);
    if (!list.length) return [];
    return [{ pool, label: challengePoolLabel(pool), people: list }];
  });
}

export function ppoSeasons(rows: PpoRow[]): string[] {
  return [...new Set(rows.map((row) => row.season))].sort().reverse();
}

export function filterRows<T>(rows: T[], query: string, text: (row: T) => string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => text(row).toLowerCase().includes(needle));
}

export function pageOf<T>(rows: T[], page: number, size = BOARD_PAGE_SIZE): { page: number; pages: number; slice: T[] } {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * size;
  return { page: current, pages, slice: rows.slice(start, start + size) };
}

export function officialScopeOf(input: {
  scope?: string | null | undefined;
  date?: string | null | undefined;
  venue?: string | null | undefined;
}): OfficialScope {
  if (input.scope === "directory" || input.scope === "meeting") return input.scope;
  return asDate(input.date) && asVenue(input.venue) ? "meeting" : "directory";
}

export function emptyBoardLabel(available: boolean): string {
  return available ? "呢個範圍未有收錄。" : "暫時未有呢項官方資料。";
}
