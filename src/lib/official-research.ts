export type OfficialRow = Record<string, string | number | null>;
export type OfficialSection = { rows: OfficialRow[]; available: boolean };
export function officialMeetingDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("賽日無效");
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== value) throw new Error("賽日無效");
  return value;
}
export function officialHorseBrand(id: string): string {
  const match = /^horse_([A-Z]\d{3})$/.exec(id);
  if (!match?.[1]) throw new Error("馬匹編號無效");
  return match[1];
}
/** Public official fields only; never pass through model or arbitrary D1 fields. */
export function projectOfficialRows(rows: Record<string, unknown>[], fields: readonly string[]): OfficialRow[] {
  return rows.map(row => Object.fromEntries(fields.map(field => {
    const value = row[field];
    return [field, typeof value === "string" || (typeof value === "number" && Number.isFinite(value)) ? value : null];
  })));
}
export const HORSE_OFFICIAL_FIELDS = {
  rating: ["horse_id", "horse_name", "brand_no", "race_date", "rating", "finish_text", "body_weight", "distance_m", "track", "scraped_at"],
  performance: ["horse_id", "brand_no", "section", "label_a", "label_b", "starts", "wins", "seconds", "thirds", "losses", "scraped_at"],
  movement: ["horse_id", "brand_no", "from_loc", "to_loc", "arrive_date", "scraped_at"],
  overoar: ["brand_no", "horse_name", "as_of_date", "diagnosis_date", "surgery", "scraped_at"],
} as const;
export const POOL_OFFICIAL_FIELDS = ["pool", "meeting_date", "rank_no", "person_name", "points", "wins", "seconds", "thirds", "fourths", "remark", "scraped_at"] as const;
export const DRAW_OFFICIAL_FIELDS = ["season_code", "racecourse", "course_label", "distance_m", "draw", "starts", "win_pct", "place_pct", "scraped_at"] as const;