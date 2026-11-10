/** 月份查詢未完成時唔報 0，避免賽程頁把讀取中顯示成「沒有賽馬日」。 */
export function scheduleMonthTicker(input: {
  ym: string;
  cancellationText?: string | null;
  pending: boolean;
  failed: boolean;
  meetingCount: number;
}): string {
  if (input.cancellationText) return input.cancellationText;
  if (input.pending) return `${input.ym} · 讀取賽馬日…`;
  if (input.failed) return `${input.ym} · 賽馬日暫未能讀取`;
  return `${input.ym} · ${input.meetingCount} 個賽馬日`;
}
