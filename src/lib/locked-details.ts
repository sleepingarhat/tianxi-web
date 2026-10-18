export const LOCKED_FACTORS = [
  ["recency", "休息"], ["distance", "途程"], ["going", "場地"], ["draw", "檔位"],
  ["weight", "負磅"], ["condition", "狀態"], ["injury", "傷患"], ["jtCombo", "騎練"],
] as const;

export function parseLockedFactors(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const scores = Object.fromEntries(LOCKED_FACTORS.map(([key]) => [key,
      typeof record[key] === "number" && Number.isFinite(record[key]) ? record[key] : null,
    ])) as Record<typeof LOCKED_FACTORS[number][0], number | null>;
    return { scores, used: Array.isArray(record['used']) ? record['used'].filter((v): v is string => typeof v === "string") : [] };
  } catch { return null; }
}