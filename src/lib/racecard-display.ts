/**
 * 公開排位頁標題列嘅途程／地況（顯示用）。
 * 只接受日期、馬場、場次都對得上嘅標題；馬匹往績入面嘅米數唔用。
 */

export type RacecardDisplay = {
  matched: boolean;
  distance: number | null;
  going: string | null;
  surface: string | null;
  title: string | null;
};

const EMPTY: RacecardDisplay = { matched: false, distance: null, going: null, surface: null, title: null };

export function visibleRacecardText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseRacecardDisplay(
  html: string,
  expect: { date: string; venue: "ST" | "HV"; raceNumber: number },
): RacecardDisplay {
  const date = String(expect.date ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const raceNumber = Number(expect.raceNumber);
  if (!date || !Number.isInteger(raceNumber) || raceNumber < 1 || raceNumber > 14) return EMPTY;
  if (expect.venue !== "ST" && expect.venue !== "HV") return EMPTY;
  const text = visibleRacecardText(html);
  const zhDate = `${date[1]}年${Number(date[2])}月${Number(date[3])}日`;
  const venueZh = expect.venue === "ST" ? "沙田" : "跑馬地";
  const raceRe = new RegExp(`第\\s*${raceNumber}\\s*場`);
  if (!text.includes(zhDate) || !text.includes(venueZh) || !raceRe.test(text)) return EMPTY;
  const title = text.match(new RegExp(`第\\s*${raceNumber}\\s*場\\s*[-–—]\\s*([^\\d]{1,40}?)\\s*${date[1]}年`))?.[1]?.trim() || null;
  const head = text.match(
    new RegExp(
      `第\\s*${raceNumber}\\s*場[\\s\\S]{0,80}?${date[1]}年${Number(date[2])}月${Number(date[3])}日[\\s\\S]{0,40}?${venueZh}[\\s\\S]{0,24}?\\d{1,2}:\\d{2}\\s+([^,，]{2,30})[,，]\\s*(\\d{3,4})\\s*米[,，]\\s*([^\\s,，]{1,16})`,
    ),
  );
  if (!head) return { matched: true, distance: null, going: null, surface: null, title };
  const distance = Number(head[2]);
  if (!Number.isInteger(distance) || distance < 800 || distance > 4000) {
    return { matched: true, distance: null, going: null, surface: head[1]?.trim() || null, title };
  }
  return {
    matched: true,
    distance,
    going: head[3]?.trim() || null,
    surface: head[1]?.trim() || null,
    title,
  };
}
