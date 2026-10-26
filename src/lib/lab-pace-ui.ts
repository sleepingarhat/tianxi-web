/** 走位／節奏 UI 純函式（無 I/O）。 */

export const PACE_DISCLAIMER = "研究提示・唔入排名";

export type PaceForecastLabel = "快" | "中" | "慢";

export function forecastTone(label: PaceForecastLabel | string | null | undefined): "win" | "lose" | "ink" | "gold" {
  if (label === "快") return "lose";
  if (label === "慢") return "win";
  if (label === "中") return "gold";
  return "ink";
}

export function roleTone(role: string | null | undefined): "gold" | "win" | "ink" | "lose" {
  if (role === "leader" || role === "領放" || role === "放") return "lose";
  if (role === "prominent" || role === "跟前" || role === "前") return "gold";
  if (role === "midfield" || role === "居中" || role === "中") return "ink";
  if (role === "held-up" || role === "後上" || role === "後") return "win";
  return "ink";
}

export function formatSectionTime(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${Number(v).toFixed(2)}s`;
}

export function formatDelta(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const n = Number(v);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}s`;
}

export function deltaTone(v: number | null | undefined): "win" | "lose" | "ink" {
  if (v == null || !Number.isFinite(v)) return "ink";
  if (v <= -0.15) return "win"; // 快過中位
  if (v >= 0.15) return "lose";
  return "ink";
}

/** bump chart 用：把位置轉成 SVG y（第1＝頂）。 */
export function positionToY(pos: number, maxPos: number, height: number, pad = 12): number {
  if (!Number.isFinite(pos) || maxPos < 1) return height / 2;
  const t = (pos - 1) / Math.max(1, maxPos - 1);
  return pad + t * (height - pad * 2);
}

export function validateRaceIdInput(raw: string): string | null {
  const id = raw.trim();
  if (!id) return null;
  const canonical = id.startsWith("race_") ? id : `race_${id}`;
  if (!/^race_\d{4}-\d{2}-\d{2}_(ST|HV)_\d+$/.test(canonical)) return null;
  return canonical;
}

export function sectionLabel(n: number, total: number): string {
  if (total <= 1) return `第${n}段`;
  if (n === 1) return "早段";
  if (n === total) return "末段";
  return `第${n}段`;
}
