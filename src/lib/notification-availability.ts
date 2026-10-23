export function racedayIsLive(enabled: unknown, pushConfigured: boolean, telegramConfigured: boolean) {
  return enabled === true && (pushConfigured || telegramConfigured);
}
export function assertRacedayOptIn(enabled: boolean | undefined, live: boolean) {
  if (enabled === true && !live) throw new Error('收賽日提示即將推出，暫時未能登記');
}
export function shouldRecordRacedaySkip(previous: {error: string | null; created_at: string} | null, reason: string, hkDate: string) {
  return !previous || previous.error !== reason || new Date(new Date(previous.created_at).getTime() + 8 * 3600000).toISOString().slice(0, 10) !== hkDate;
}