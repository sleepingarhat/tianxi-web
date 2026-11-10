/**
 * Wave7 官方讀取：賽日數據海報、馬匹評分、馬匹消息、進口資格、排位馬匹資料、排位檔案。
 * 只讀公開 Worker；官方圖片同檔案用原網址外連，唔下載、唔轉存，亦唔解壓。
 */
import type { OfficialEnvelope, PolicyPage, RatingBoard } from "./official-boards";

type Row = Record<string, unknown>;

function asRow(value: unknown): Row | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : null;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

function int(value: unknown, min: number, max: number): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && /^-?\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
function date(value: unknown): string | null {
  return typeof value === "string" && DATE.test(value) ? value : null;
}

// ---------------------------------------------------------------------------
// 官方網址白名單
// ---------------------------------------------------------------------------

type QueryRule = "none" | "media" | "trackMap";
type AssetRule = { host: string; path: RegExp; query: QueryRule; image: boolean };

const MEDIA_QUERY_KEYS = new Set(["rev", "sc_lang", "hash", "la"]);
const MEDIA_QUERY_VALUE = /^[A-Za-z0-9-]{1,64}$/;

const RULES: AssetRule[] = [
  { host: "consvc.hkjc.com", path: /^\/-\/media\/Sites\/JCRW\/FinishPhotos\/[A-Za-z0-9_./-]+\.jpe?g$/i, query: "none", image: true },
  { host: "consvc.hkjc.com", path: /^\/-\/media\/Sites\/JCRW\/Page\/stats_centre\/[A-Za-z0-9_/-]+\.jpe?g$/i, query: "media", image: true },
  { host: "consvc.hkjc.com", path: /^\/-\/media\/Sites\/JCRW\/Page\/pps_import_critieria\/[A-Za-z0-9_/-]+\.(?:gif|jpe?g|png)$/i, query: "media", image: true },
  { host: "www.hkjc.com", path: /^\/chinese\/racing\/racecourse_img\.asp$/i, query: "trackMap", image: true },
  { host: "racing.hkjc.com", path: /^\/racing\/content\/Chinese\/RaceCourse\/[A-Za-z0-9_-]+\.(?:gif|jpe?g|png)$/i, query: "none", image: true },
  { host: "racing.hkjc.com", path: /^\/racing\/content\/PDF\/RaceCard\/[A-Za-z0-9_-]+\.pdf$/i, query: "none", image: false },
  { host: "racing.hkjc.com", path: /^\/general\/-\/media\/Sites\/JCRW\/pp_formsheet\/[A-Za-z0-9_/-]+\.pdf$/i, query: "media", image: false },
  { host: "racing.hkjc.com", path: /^\/Racing\/Info\/MCS\/[A-Za-z0-9_/-]+\.[A-Za-z0-9.]{1,12}$/i, query: "none", image: false },
];

function queryOk(rule: QueryRule, params: URLSearchParams): boolean {
  const keys = [...params.keys()];
  if (rule === "none") return keys.length === 0;
  if (rule === "trackMap") {
    return keys.length === 1 && keys[0] === "filename" && /^[A-Za-z0-9_-]{1,40}\.(?:gif|jpe?g|png)$/i.test(params.get("filename") ?? "");
  }
  return keys.every((key) => MEDIA_QUERY_KEYS.has(key) && MEDIA_QUERY_VALUE.test(params.get(key) ?? ""));
}

/**
 * 只放行已核對嘅馬會官方路徑。image 只限圖片路徑；link 亦包括排位 PDF、進口檢驗 PDF 同消息檔案。
 * 唔喺白名單就回 null：唔當圖片渲染，亦唔出連結。
 */
export function officialAssetUrl(value: unknown, use: "image" | "link"): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.length > 400 || /\.\.|\\|%2e|%2f|%5c|\s/i.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return null;
  const rule = RULES.find((item) => item.host === url.hostname && item.path.test(url.pathname));
  if (!rule) return null;
  if (use === "image" && !rule.image) return null;
  if (!queryOk(rule.query, url.searchParams)) return null;
  return url.href;
}

// ---------------------------------------------------------------------------
// 賽日數據海報
// ---------------------------------------------------------------------------

export type StatsPoster = {
  slot: string;
  label: string;
  posterDate: string | null;
  windowEnd: string | null;
  lastUpdate: string | null;
  imageUrl: string | null;
};

const STATS_SLOTS: Record<string, string> = { raceday_stats: "賽日數據", whos_hot: "熱門馬" };

export function readStatsPosters(envelope: OfficialEnvelope): StatsPoster[] {
  return envelope.rows.flatMap((value) => {
    const row = asRow(value);
    const slot = row ? text(row["slot"]) : null;
    if (!row || !slot) return [];
    return [{
      slot,
      label: STATS_SLOTS[slot] ?? slot,
      posterDate: date(row["posterDate"]),
      windowEnd: text(row["windowEnd"]),
      lastUpdate: text(row["lastUpdate"]),
      imageUrl: officialAssetUrl(row["imagePath"], "image"),
    }];
  });
}

/** 2026-11-10T12:00:00+08:00 → 2026-11-10 12:00（香港時間原文，唔換時區）。 */
export function officialStamp(value: string | null): string {
  if (!value) return "—";
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return match ? `${match[1]} ${match[2]}` : value;
}

// ---------------------------------------------------------------------------
// 馬匹評分
// ---------------------------------------------------------------------------

export const RATING_BOARDS: { value: RatingBoard; label: string }[] = [
  { value: "clas", label: "評分榜" },
  { value: "csum", label: "評分變動" },
  { value: "tp50", label: "最高評分" },
];

export type RatingRow = {
  lineNo: number | null;
  brand: string;
  nameEn: string | null;
  nameCh: string;
  rating: number | null;
  changeText: string | null;
  markText: string | null;
  trainerName: string | null;
};

/** 全部行照收，包括最高評分並列（tp50 可多過 50 匹），唔截斷。 */
export function readRatingRows(envelope: OfficialEnvelope): RatingRow[] {
  return envelope.rows.flatMap((value) => {
    const row = asRow(value);
    if (!row) return [];
    const brand = text(row["brand"]);
    const nameCh = text(row["nameCh"]) ?? text(row["nameEn"]);
    if (!brand || !nameCh) return [];
    return [{
      lineNo: int(row["lineNo"], 1, 99999),
      brand,
      nameEn: text(row["nameEn"]),
      nameCh,
      rating: int(row["rating"], 0, 200),
      changeText: text(row["changeText"]),
      markText: text(row["markText"]),
      trainerName: text(row["trainerName"]),
    }];
  });
}

// ---------------------------------------------------------------------------
// 馬匹消息
// ---------------------------------------------------------------------------

export type NewsRow = {
  view: string;
  lineNo: number | null;
  title: string;
  publishedAt: string | null;
  fileDate: string | null;
  fileUrl: string | null;
};

export type NewsGroup = { view: string; label: string; rows: NewsRow[] };

export function readNewsRows(envelope: OfficialEnvelope): NewsRow[] {
  return envelope.rows.flatMap((value) => {
    const row = asRow(value);
    if (!row) return [];
    const view = text(row["view"]);
    const title = text(row["title"]);
    if (!view || !title) return [];
    return [{
      view,
      lineNo: int(row["lineNo"], 1, 9999),
      title,
      publishedAt: text(row["publishedAt"]),
      fileDate: date(row["fileDate"]),
      fileUrl: officialAssetUrl(row["artifactPath"], "link"),
    }];
  });
}

/** 分類名取自該類第一個官方標題，去走尾段發布時間同字距；標題本身照原文顯示。 */
export function newsGroupLabel(title: string): string {
  const label = title.replace(/\(\s*\d{4}\/\d{2}\/\d{2}[^)]*\)\s*$/, "").replace(/\s+/g, "");
  return label || title;
}

export function groupNews(rows: NewsRow[]): NewsGroup[] {
  const groups = new Map<string, NewsGroup>();
  for (const row of rows) {
    const group = groups.get(row.view) ?? { view: row.view, label: newsGroupLabel(row.title), rows: [] };
    group.rows.push(row);
    groups.set(row.view, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    rows: [...group.rows].sort((a, b) => (a.lineNo ?? 9999) - (b.lineNo ?? 9999)),
  }));
}

// ---------------------------------------------------------------------------
// 進口資格
// ---------------------------------------------------------------------------

export type PolicyBlock = { type: "paragraph"; text: string } | { type: "table"; rows: string[][] };
export type PolicyLayout = {
  tabs: { page: PolicyPage; label: string }[];
  imageUrl: string | null;
  exam: { text: string; url: string | null } | null;
  blocks: PolicyBlock[];
};

const FOOTNOTE = /^[*＊#]/;

/**
 * 用 kind 還原版面：段落按 blockNo，表格按 rowNo／colNo 砌（儲存格原文保留 *）。
 * 表格放喺佢對應註腳（* 或 # 開頭段落）之前；冇對應註腳嘅表格順序放最後。
 */
export function importPolicyLayout(envelope: OfficialEnvelope, page: PolicyPage): PolicyLayout {
  const rows = envelope.rows.flatMap((value) => {
    const row = asRow(value);
    if (!row) return [];
    const rowPage = text(row["page"]);
    if (rowPage && rowPage !== page) return [];
    return [row];
  });
  const tabs: PolicyLayout["tabs"] = [];
  let imageUrl: string | null = null;
  let exam: PolicyLayout["exam"] = null;
  const paragraphs: { blockNo: number; text: string }[] = [];
  const tables = new Map<number, Map<number, Map<number, string>>>();
  for (const row of rows) {
    const kind = text(row["kind"]);
    const blockNo = int(row["blockNo"], 0, 999) ?? 0;
    if (kind === "tab") {
      const label = text(row["text"]);
      const asset = text(row["assetPath"]) ?? "";
      const tabPage: PolicyPage | null = /\/ppgs-/.test(asset) ? "ppgs" : /\/pps-/.test(asset) ? "pps" : null;
      if (label && tabPage && !tabs.some((tab) => tab.page === tabPage)) tabs.push({ page: tabPage, label });
    } else if (kind === "image") {
      imageUrl ??= officialAssetUrl(row["assetPath"], "image");
    } else if (kind === "exam_pdf") {
      const label = text(row["text"]);
      if (label && !exam) exam = { text: label, url: officialAssetUrl(row["assetPath"], "link") };
    } else if (kind === "paragraph") {
      const body = typeof row["text"] === "string" ? row["text"] : "";
      if (body.trim()) paragraphs.push({ blockNo, text: body });
    } else if (kind === "table_cell") {
      const rowNo = int(row["rowNo"], 0, 999) ?? 0;
      const colNo = int(row["colNo"], 0, 999) ?? 0;
      const table = tables.get(blockNo) ?? new Map<number, Map<number, string>>();
      const cells = table.get(rowNo) ?? new Map<number, string>();
      cells.set(colNo, typeof row["text"] === "string" ? row["text"] : "");
      table.set(rowNo, cells);
      tables.set(blockNo, table);
    }
  }
  const tableBlocks: PolicyBlock[] = [...tables.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, table]) => ({
      type: "table" as const,
      rows: [...table.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, cells]) => [...cells.entries()].sort(([a], [b]) => a - b).map(([, cell]) => cell)),
    }));
  const blocks: PolicyBlock[] = [];
  let nextTable = 0;
  for (const paragraph of paragraphs.sort((a, b) => a.blockNo - b.blockNo)) {
    if (FOOTNOTE.test(paragraph.text.trim()) && nextTable < tableBlocks.length) blocks.push(tableBlocks[nextTable++]!);
    blocks.push({ type: "paragraph", text: paragraph.text });
  }
  blocks.push(...tableBlocks.slice(nextTable));
  return { tabs, imageUrl, exam, blocks };
}

// ---------------------------------------------------------------------------
// 排位馬匹資料
// ---------------------------------------------------------------------------

export type RacecardProfileRow = {
  raceNo: number;
  horseNo: number | null;
  reserve: boolean;
  horseId: string | null;
  brand: string | null;
  horseName: string;
  age: number | null;
  sex: string | null;
  seasonStakes: number | null;
  owner: string | null;
  sire: string | null;
  dam: string | null;
  importType: string | null;
};

export function readRacecardProfiles(envelope: OfficialEnvelope): RacecardProfileRow[] {
  return envelope.rows.flatMap((value) => {
    const row = asRow(value);
    if (!row) return [];
    const raceNo = int(row["raceNo"], 1, 15);
    const horseName = text(row["horseName"]);
    if (raceNo == null || !horseName) return [];
    return [{
      raceNo,
      horseNo: int(row["horseNo"], 1, 20),
      reserve: row["reserve"] === true,
      horseId: text(row["horseId"]),
      brand: text(row["brand"]),
      horseName,
      age: int(row["age"], 0, 30),
      sex: text(row["sex"]),
      seasonStakes: int(row["seasonStakes"], 0, 999_999_999),
      owner: text(row["owner"]),
      sire: text(row["sire"]),
      dam: text(row["dam"]),
      importType: text(row["importType"]),
    }];
  });
}

/** 由 horse_K308、HK_2024_K308 或 K308 取烙號。 */
export function brandOf(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const match = value.trim().toUpperCase().match(/(?:^|_)([A-Z]\d{3,4})$/);
    if (match) return match[1]!;
  }
  return null;
}

/** 出賽馬按場次＋馬號配對；兩邊都有烙號而唔同就唔配，避免張冠李戴。 */
export function profileForRunner(
  rows: RacecardProfileRow[],
  raceNo: number,
  horseNo: unknown,
  brand: string | null,
): RacecardProfileRow | null {
  const no = int(horseNo, 1, 20);
  if (no == null) return null;
  const row = rows.find((item) => !item.reserve && item.raceNo === raceNo && item.horseNo === no);
  if (!row) return null;
  if (brand && row.brand && brand !== row.brand.toUpperCase()) return null;
  return row;
}

export function reservesForRace(rows: RacecardProfileRow[], raceNo: number): RacecardProfileRow[] {
  return rows.filter((row) => row.reserve && row.raceNo === raceNo).sort((a, b) => (a.horseNo ?? 99) - (b.horseNo ?? 99));
}

export function formatStakes(value: number | null): string {
  if (value == null) return "—";
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export type ProfileCell = { label: string; value: string };

/** 原文照顯示：進口類別寫 PPG 就顯示 PPG。空值一律「—」。 */
export function profileCells(row: RacecardProfileRow): { short: ProfileCell[]; long: ProfileCell[] } {
  return {
    short: [
      { label: "年齡", value: row.age != null ? String(row.age) : "—" },
      { label: "性別", value: row.sex ?? "—" },
      { label: "季內獎金", value: formatStakes(row.seasonStakes) },
      { label: "進口類別", value: row.importType ?? "—" },
    ],
    long: [
      { label: "馬主", value: row.owner ?? "—" },
      { label: "父系", value: row.sire ?? "—" },
      { label: "母系", value: row.dam ?? "—" },
    ],
  };
}

// ---------------------------------------------------------------------------
// 排位檔案及跑道圖
// ---------------------------------------------------------------------------

export type RacecardFile = {
  raceNo: number;
  kind: "starter_pdf_all" | "starter_pdf" | "track_map" | "track_map_thumb";
  url: string;
  distance: number | null;
  surfaceCode: string | null;
};

const FILE_KINDS = new Set(["starter_pdf_all", "starter_pdf", "track_map", "track_map_thumb"]);

export function readRacecardFiles(envelope: OfficialEnvelope): RacecardFile[] {
  return envelope.rows.flatMap((value) => {
    const row = asRow(value);
    if (!row) return [];
    const kind = text(row["kind"]);
    const raceNo = int(row["raceNo"], 0, 15);
    if (!kind || !FILE_KINDS.has(kind) || raceNo == null) return [];
    const image = kind === "track_map" || kind === "track_map_thumb";
    const url = officialAssetUrl(row["artifactPath"], image ? "image" : "link");
    if (!url) return [];
    if (!image && !/\.pdf$/i.test(new URL(url).pathname)) return [];
    return [{
      raceNo,
      kind: kind as RacecardFile["kind"],
      url,
      distance: int(row["distance"], 800, 3200),
      surfaceCode: text(row["surfaceCode"]),
    }];
  });
}

export type RaceFiles = {
  raceNo: number;
  pdf: string | null;
  map: string | null;
  thumb: string | null;
  distance: number | null;
  surfaceCode: string | null;
};

export function groupRacecardFiles(rows: RacecardFile[]): { allPdf: string | null; races: RaceFiles[] } {
  let allPdf: string | null = null;
  const races = new Map<number, RaceFiles>();
  for (const row of rows) {
    if (row.kind === "starter_pdf_all") {
      allPdf ??= row.url;
      continue;
    }
    if (row.raceNo < 1) continue;
    const race = races.get(row.raceNo) ?? { raceNo: row.raceNo, pdf: null, map: null, thumb: null, distance: null, surfaceCode: null };
    if (row.kind === "starter_pdf") race.pdf ??= row.url;
    if (row.kind === "track_map") race.map ??= row.url;
    if (row.kind === "track_map_thumb") race.thumb ??= row.url;
    race.distance ??= row.distance;
    race.surfaceCode ??= row.surfaceCode;
    races.set(row.raceNo, race);
  }
  return { allPdf, races: [...races.values()].sort((a, b) => a.raceNo - b.raceNo) };
}

/** 1650 米 · 草地。路面代號唔識就唔估。 */
export function trackMapCaption(race: Pick<RaceFiles, "distance" | "surfaceCode">): string {
  const surface = race.surfaceCode === "t" ? "草地" : "";
  return [race.distance ? `${race.distance}米` : "", surface].filter(Boolean).join(" · ");
}
