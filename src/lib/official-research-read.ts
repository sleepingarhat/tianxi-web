import type { OfficialSection } from './official-research';
/** An all-unavailable result is a failed read, never a ten-minute successful cache entry. */
export function requireOfficialRead<T extends Record<string, OfficialSection>>(value: T): T {
  if (Object.values(value).every(section => !section.available)) throw new Error('官方資料暫未能讀取，請重試');
  return value;
}