/** 預設賽日：最近一個唔遲過今日（香港）嘅存檔賽日；全部係未來就用最早嗰個。 */
export function defaultWithdrawalDate(dates: readonly string[], todayHk: string): string | null {
  const past = dates.filter(d => d <= todayHk).sort().reverse();
  if (past.length) return past[0] ?? null;
  const future = [...dates].sort();
  return future[0] ?? null;
}

/** ISO 時間轉香港時間「YYYY-MM-DD HH:mm HKT」；唔係有效時間就原樣返回。 */
export function hkStamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return value;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(t));
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')} ${hour}:${get('minute')} HKT`;
}
