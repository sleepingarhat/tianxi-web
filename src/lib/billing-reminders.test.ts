import { describe, it, expect } from 'vitest';
import { renewalReminder } from './billing-reminders';
const s = { id: 'test', current_period_end: '2026-11-02T00:00:00Z', state: 'Paid', cancel_at_period_end: false, rate_plan: { public_name: 'Workers Paid' } };
describe('付款預警', () => {
  it('提前七日提示，八日以前不提示', () => {
    expect(renewalReminder(s, Date.parse('2026-10-25'))).toBeNull();
    expect(renewalReminder(s, Date.parse('2026-10-26'))?.stage).toBe('7-days');
  });
  it('提前三日提示', () => { expect(renewalReminder(s, Date.parse('2026-10-30'))?.stage).toBe('3-days'); });
  it('提前一日提示', () => { expect(renewalReminder(s, Date.parse('2026-11-01'))?.stage).toBe('1-day'); });
  it('取消狀態需要核對', () => { expect(renewalReminder({ ...s, cancel_at_period_end: true }, Date.parse('2026-10-19'))?.stage).toBe('cancellation'); });
  it('非Paid狀態需要核對', () => { expect(renewalReminder({ ...s, state: 'Pending' }, Date.parse('2026-10-19'))?.stage).toBe('status-review'); });
  it('缺日期不得猜續期', () => { expect(() => renewalReminder({ ...s, current_period_end: '' }, Date.now())).toThrow(); });
});
