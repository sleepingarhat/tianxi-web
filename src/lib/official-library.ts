/**
 * 官方資料產品面：只整理已經有公開讀取嘅板。
 * 空白代表未收錄。唔估場地、唔補試閘、唔把檔名標記當成另一項事實。
 */
import type { ConghuaRow, FwbRow, JtRow, OveRow } from "./official-boards";
import { formatOfficialRate } from "./official-boards";
import type { RatingRow } from "./official-records";

export const OFFICIAL_GAP_NOTE =
  "派彩同彩池狀態喺官方派彩頁。場地狀況、分段時間、配備逐項、試閘逐匹成績同競賽事件報告未有公開讀取接口，呢度唔顯示，亦唔會自己補。";

export const DIRECTORY_SURFACES = [
  { id: "ratings", title: "馬匹評分", blurb: "評分榜、評分變動、最高評分。接口有幾多行就顯示幾多行。" },
  { id: "news", title: "馬匹消息", blurb: "試閘、獸醫、配備、易廄、游泳等官方檔案，只提供外連。" },
  { id: "stats", title: "賽日數據海報", blurb: "賽日數據同熱門馬海報。跟官方海報日期，唔跟你揀嘅賽日。" },
  { id: "notes", title: "特別註解", blurb: "賽果代號對照，例如未有跑畢全程、退出。" },
  { id: "former", title: "馬匹曾用名", blurb: "已收錄嘅曾用名、血統同進口資料。" },
  { id: "vet", title: "獸醫檢查名單", blurb: "獸醫名單截至日。唔係某一場名次。" },
  { id: "ppo", title: "自購馬往績", blurb: "官方自購馬往績備註。" },
  { id: "policy", title: "進口資格", blurb: "自購馬同自購新馬進口資格原文。" },
] as const;

export const MEETING_SURFACES = [
  { id: "photos", title: "終點照片", blurb: "只列出已收錄場次。冇相就係未收錄。" },
  { id: "files", title: "跑道圖及排位檔", blurb: "官方跑道圖、縮圖同排位 PDF。" },
  { id: "profile", title: "排位馬匹資料", blurb: "年齡、性別、馬主、血統同進口類別。空欄係未收錄。" },
  { id: "meeting", title: "賽日附屬", blurb: "獸醫檢查、從化往來、騎練合作、已申報特別獎金、騎師王／練馬師王賠率。一次顯示一項。" },
] as const;

export const OFFICIAL_SURFACES = [...DIRECTORY_SURFACES, ...MEETING_SURFACES] as const;
export type OfficialSurface = (typeof OFFICIAL_SURFACES)[number]["id"];

const SURFACE_IDS = new Set<string>(OFFICIAL_SURFACES.map((item) => item.id));

export function isOfficialSurface(value: string): value is OfficialSurface {
  return SURFACE_IDS.has(value);
}

export function officialSurfaceMeta(id: OfficialSurface) {
  return OFFICIAL_SURFACES.find((item) => item.id === id) ?? OFFICIAL_SURFACES[0]!;
}

export function surfaceNeedsMeeting(id: OfficialSurface): boolean {
  return MEETING_SURFACES.some((item) => item.id === id);
}

const VENUE_LABEL: Record<string, string> = { ST: "沙田", HV: "跑馬地" };

/** 消息列上嘅馬場或海外賽事代號。兩邊都冇就回 null，唔寫「—」。 */
export function newsPlaceLabel(venue: string | null | undefined, simulcastCode: string | null | undefined): string | null {
  const parts: string[] = [];
  const place = typeof venue === "string" ? venue.trim() : "";
  const sim = typeof simulcastCode === "string" ? simulcastCode.trim() : "";
  if (place) parts.push(VENUE_LABEL[place] ?? place);
  if (sim) parts.push(/^S\d+$/i.test(sim) ? `海外賽事 ${sim.toUpperCase()}` : sim);
  return parts.length ? parts.join(" · ") : null;
}

/** 已載入嘅評分榜入面，烙號完全相符先算同一匹。唔模糊配對。 */
export function ratingForBrand<T extends Pick<RatingRow, "brand">>(rows: T[], brand: string | null | undefined): T | null {
  if (typeof brand !== "string") return null;
  const key = brand.trim().toUpperCase();
  if (!key) return null;
  return rows.find((row) => row.brand.trim().toUpperCase() === key) ?? null;
}

export function finishPhotoGaps(photoRaces: number[], indexedRaces: number[]): { collected: number[]; missing: number[] } {
  const raceNo = (value: number) => Number.isInteger(value) && value >= 1 && value <= 15;
  const collected = [...new Set(photoRaces.filter(raceNo))].sort((a, b) => a - b);
  const known = [...new Set(indexedRaces.filter(raceNo))].sort((a, b) => a - b);
  if (!known.length) return { collected, missing: [] };
  const have = new Set(collected);
  return { collected, missing: known.filter((race) => !have.has(race)) };
}

export function raceListLabel(races: number[]): string {
  if (!races.length) return "";
  return races.map((race) => `第${race}場`).join("、");
}

export type RunnerSlot = {
  raceNo: number;
  horseNo: number | null;
  brand: string | null;
  reserve: boolean;
};

type SlotRow = {
  raceNo: number | null;
  horseNo: number | null;
  reserve: boolean;
  brand?: string | null;
  horseCode?: string | null;
};

function brandsClash(slotBrand: string | null, rowBrand: string | null | undefined): boolean {
  const left = slotBrand?.trim().toUpperCase() ?? "";
  const right = rowBrand?.trim().toUpperCase() ?? "";
  return Boolean(left && right && left !== right);
}

function sameRunner(slot: RunnerSlot, row: SlotRow): boolean {
  if (row.raceNo == null || slot.horseNo == null || row.horseNo == null) return false;
  if (row.raceNo !== slot.raceNo || row.horseNo !== slot.horseNo || row.reserve !== slot.reserve) return false;
  return !brandsClash(slot.brand, row.brand ?? row.horseCode ?? null);
}

export type RunnerFact = { key: string; label: string; text: string };

/** 只回傳對得上呢匹馬嘅官方列。對唔上就唔出句，避免每匹馬都寫「未有」。 */
export function runnerMeetingFacts(
  input: { ove: OveRow[]; conghua: ConghuaRow[]; jt: JtRow[]; fwb: FwbRow[] },
  slot: RunnerSlot,
): RunnerFact[] {
  const facts: RunnerFact[] = [];
  const ove = input.ove.find((row) => sameRunner(slot, row));
  if (ove) {
    const dates = [ove.injuryDate ? `日期 ${ove.injuryDate}` : "", ove.passedDate ? `通過 ${ove.passedDate}` : ""].filter(Boolean).join(" · ");
    facts.push({ key: "ove", label: "獸醫檢查", text: dates ? `${ove.detail}（${dates}）` : ove.detail });
  }
  const conghua = input.conghua.find((row) => sameRunner(slot, row));
  if (conghua) {
    facts.push({
      key: "conghua",
      label: "從化往來",
      text: `抵埗 ${conghua.arrivedDate ?? "—"} · 返回 ${conghua.returnedDate ?? "—"}`,
    });
  }
  for (const row of input.jt) {
    if (!sameRunner(slot, row)) continue;
    const rate = `勝出 ${formatOfficialRate(row.winRate)} · 位置 ${formatOfficialRate(row.placeRate)}`;
    const asOf = row.asOfText ? `截至 ${row.asOfText}` : "";
    if (row.section === "debut") {
      const extra = [row.importType, row.trainerName, asOf].filter(Boolean).join(" · ");
      facts.push({ key: `debut-${row.horseNo}`, label: "初出", text: extra ? `${rate} · ${extra}` : rate });
    } else {
      facts.push({ key: `combo-${row.horseNo}`, label: "騎練合作", text: asOf ? `${rate} · ${asOf}` : rate });
    }
  }
  const fwb = input.fwb.find((row) => sameRunner(slot, { ...row, horseCode: row.brand }));
  const bonus = fwb ? fwb.bonusCh || fwb.bonusEn : null;
  if (fwb && bonus) facts.push({ key: "fwb", label: "已申報特別獎金", text: bonus });
  return facts;
}
