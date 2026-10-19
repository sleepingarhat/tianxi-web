/** Preserve official Chinese class names and group-race labels. */
export function racingClassLabel(value: unknown): string {
  if (value == null) return '班次未提供';
  const raw = String(value).trim();
  if (!raw) return '班次未提供';
  if (/^[1-5]$/.test(raw)) return `第${raw}班`;
  const numeric = raw.match(/^Class\s*([1-5])$/i);
  if (numeric) return `第${numeric[1]}班`;
  return raw;
}