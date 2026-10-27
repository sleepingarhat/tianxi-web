// 官方排位表「場次頭」（賽事名稱、班次、評分範圍、獎金、跑道、場地）。只作展示，不作預測輸入。
export type RaceHeaderRow = {
  raceNumber: number;
  raceName: string | null;
  postTime: string | null;
  raceClass: string | null;
  ratingRange: string | null;
  prize: number | null;
  track: string | null;
  course: string | null;
  going: string | null;
  distance: number | null;
};

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function normalizeRaceHeaders(rows: Record<string, unknown>[]): RaceHeaderRow[] {
  const out = new Map<number, RaceHeaderRow>();
  for (const r of rows) {
    const n = Number(r["raceNumber"]);
    if (!Number.isInteger(n) || n < 1 || n > 14) continue;
    const prize = Number(String(r["prize"] ?? "").replace(/[^\d.]/g, ""));
    const distance = Number(r["distance"]);
    out.set(n, {
      raceNumber: n,
      raceName: text(r["raceName"]),
      postTime: text(r["postTime"]),
      raceClass: text(r["raceClass"]),
      ratingRange: text(r["ratingRange"]),
      prize: Number.isFinite(prize) && prize > 0 ? prize : null,
      track: text(r["track"]),
      course: text(r["course"]),
      going: text(r["going"]),
      distance: Number.isFinite(distance) && distance > 0 ? distance : null,
    });
  }
  return [...out.values()].sort((a, b) => a.raceNumber - b.raceNumber);
}

export function prizeText(prize: number | null): string | null {
  return prize == null ? null : `HK$${prize.toLocaleString("en-US")}`;
}

/** 例：「全天候」、「草地 · C+3 跑道」 */
export function trackText(h: Pick<RaceHeaderRow, "track" | "course">): string | null {
  if (!h.track && !h.course) return null;
  const course = h.course ? (/跑道$/.test(h.course) ? h.course : `${h.course} 跑道`) : null;
  return [h.track, course].filter(Boolean).join(" · ");
}

/** 評分範圍顯示「官方評分 40-0」（馬會官方評分，唔係天喜系統評分，必須標明來源） */
export function ratingText(range: string | null): string | null {
  return range && /^\d+\s*-\s*\d+$/.test(range) ? `官方評分 ${range.replace(/\s+/g, "")}` : null;
}
