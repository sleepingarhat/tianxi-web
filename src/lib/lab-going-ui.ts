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
