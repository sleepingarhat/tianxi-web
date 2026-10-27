/** 場地天氣 UI 輔助（純函式）。 */

export const GOING_DISCLAIMER = "歷史統計・研究層";
export const GOING_RESEARCH_NOTE =
  "場地／天氣偏差屬研究層歷史統計，唔影響官方凍結四揀同公開戰績。樣本不足格呈灰色。";

export function formatRate(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function formatPp(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const pp = v * 100;
  const sign = pp > 0 ? "+" : "";
  return `${sign}${pp.toFixed(digits)}pp`;
}

/** delta → 熱圖色調；sparse 一律灰。 */
export function heatTone(
  delta: number | null | undefined,
  sparse: boolean,
): "gray" | "pos" | "neg" | "neutral" {
  if (sparse || delta == null || !Number.isFinite(delta)) return "gray";
  if (delta > 0.02) return "pos";
  if (delta < -0.02) return "neg";
  return "neutral";
}

export function heatBg(tone: ReturnType<typeof heatTone>): string {
  switch (tone) {
    case "pos":
      return "bg-emerald-500/25 text-emerald-900";
    case "neg":
      return "bg-rose-500/20 text-rose-900";
    case "neutral":
      return "bg-ink/5 text-ink-2";
    default:
      return "bg-ink/10 text-ink-3";
  }
}

export function parseVenueInput(raw: string): "ST" | "HV" | null {
  const v = raw.trim().toUpperCase();
  if (v === "ST" || v === "HV") return v;
  if (raw.trim() === "沙田") return "ST";
  if (raw.trim() === "跑馬地" || raw.trim() === "快活谷") return "HV";
  return null;
}

/** 賽道清單對齊賽果 course 原文，避免用戶打「C+3」對唔上「草地 - "C+3" 賽道」。 */
export const GOING_COURSE_OPTIONS = [
  { id: "", label: "全部賽道" },
  { id: '草地 - "A" 賽道', label: "草地 A" },
  { id: '草地 - "A+2" 賽道', label: "草地 A+2" },
  { id: '草地 - "A+3" 賽道', label: "草地 A+3" },
  { id: '草地 - "B" 賽道', label: "草地 B" },
  { id: '草地 - "B+2" 賽道', label: "草地 B+2" },
  { id: '草地 - "C" 賽道', label: "草地 C" },
  { id: '草地 - "C+3" 賽道', label: "草地 C+3" },
  { id: "全天候跑道", label: "全天候" },
] as const;

export const GOING_DISTANCE_OPTIONS = [
  { id: "", label: "全部途程" },
  ...([1000, 1200, 1400, 1600, 1650, 1800, 2000, 2200, 2400] as const).map((d) => ({
    id: String(d),
    label: `${d}m`,
  })),
];

/** 地況桶同後端 normalizeGoingBucket 中文桶對齊。空＝待公佈／沿用上次同場。 */
export const GOING_CONDITION_OPTIONS = [
  { id: "", label: "待公佈／沿用上次" },
  { id: "好地", label: "好地" },
  { id: "好地至快地", label: "好地至快地" },
  { id: "快地", label: "快地" },
  { id: "好地至黏地", label: "好地至黏地" },
  { id: "黏地", label: "黏地" },
  { id: "黏地至軟地", label: "黏地至軟地" },
  { id: "軟地", label: "軟地" },
  { id: "濕快地", label: "濕快地" },
  { id: "濕慢地", label: "濕慢地" },
  { id: "濕地", label: "濕地" },
  { id: "大爛地", label: "大爛地" },
  { id: "封地", label: "封地" },
] as const;

export type MeetingPickSource = {
  id: string;
  date: string;
  venue?: string | null;
  venueName?: string | null;
  trackCondition?: string | null;
};

export function meetingListOptions(rows: readonly MeetingPickSource[]): { id: string; label: string; hint?: string }[] {
  const out: { id: string; label: string; hint?: string }[] = [{ id: "", label: "不限賽日" }];
  for (const m of rows) {
    if (!m.id || !m.date) continue;
    const venue =
      m.venueName ||
      (m.venue === "HV" ? "跑馬地" : m.venue === "ST" ? "沙田" : m.venue || "");
    const item: { id: string; label: string; hint?: string } = {
      id: m.id,
      label: venue ? `${m.date} · ${venue}` : m.date,
    };
    if (m.trackCondition) item.hint = m.trackCondition;
    out.push(item);
  }
  return out;
}

export function parseDistanceChoice(raw: string): number | undefined {
  if (!raw.trim()) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 800 || n > 3200) return undefined;
  return n;
}
