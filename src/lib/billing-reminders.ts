export type BillingSubscription = { id: string; current_period_end: string; state: string; cancel_at_period_end: boolean; rate_plan: { public_name: string } };
export function renewalReminder(s: BillingSubscription, now: number) {
  const due = Date.parse(s.current_period_end);
  if (!Number.isFinite(due)) throw new Error('續期日期未能核實');
  const days = Math.ceil((due - now) / 86400_000);
  const stage = s.cancel_at_period_end ? 'cancellation' : s.state !== 'Paid' ? 'status-review' : days < 0 ? 'overdue-review' : days <= 1 ? '1-day' : days <= 3 ? '3-days' : days <= 7 ? '7-days' : null;
  return stage ? { key: `billing:cloudflare:${s.id}:${s.current_period_end}:${stage}`, stage, days,
    text: `天喜付款提醒 · Cloudflare ${s.rate_plan.public_name}\n續期日期：${s.current_period_end.slice(0,10)}\n${stage === 'cancellation' ? '已標示期末取消，請核對以免服務受影響。' : stage === 'status-review' || stage === 'overdue-review' ? '續期或方案狀態需要核對；不能據此認定已欠款或已付款。' : `距離續期約${Math.max(0,days)}日，請確認扣款卡有效及有足夠額度。`}\n自動扣款仍可能失敗；本提醒不是付款收據，亦不保證服務不中斷。` } : null;
}
