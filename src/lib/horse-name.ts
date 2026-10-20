/** Display-only cleanup: remove a trailing registration code only when it
 * matches this runner's stable identity. Never change source records or IDs. */
export function horseDisplayName(name: string | null | undefined, horseId?: string | null): string | undefined {
  if (name == null) return undefined;
  const text = name.trim();
  const code = horseId?.replace(/^horse_/, '').toUpperCase();
  if (!code || !/^[A-Z]{1,2}\d{2,4}$/.test(code)) return text;
  const suffix = text.match(/\s*[（(]\s*([A-Z]{1,2}\d{2,4})\s*[）)]\s*$/i);
  return suffix?.[1]?.toUpperCase() === code ? text.slice(0, suffix.index).trim() || text : text;
}

/** Normalize read DTOs without mutating the archived/raw input. */
export function horseDisplayDto<T>(input: T): T {
  if (Array.isArray(input)) return input.map(horseDisplayDto) as T;
  if (!input || typeof input !== 'object') return input;
  const source = input as Record<string, unknown>;
  const result = Object.fromEntries(Object.entries(source).map(([k, v]) => [k, horseDisplayDto(v)]));
  const horseId = source['horseId'];
  const recordId = source['id'];
  const id = typeof horseId === 'string' ? horseId : typeof recordId === 'string' && recordId.startsWith('horse_') ? recordId : undefined;
  if (id) for (const field of ['nameCh', 'name']) {
    if (typeof source[field] === 'string') result[field] = horseDisplayName(source[field], id);
  }
  return result as T;
}