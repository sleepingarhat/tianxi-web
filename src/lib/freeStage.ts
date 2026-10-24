/** 免費階段門檻只表示進度；付款驗收及用戶明確批准後先開閘，不會滿額自動收費。
 *  瀏覽器安全預設；實際門檻及開閘時鎖定名額由會員 RPC 提供。 */
export const DEFAULT_PAYWALL_THRESHOLD = 200;
/** Client fallback only; runtime threshold/cap comes from membership RPCs. */
export const FOUNDING_SLOTS = DEFAULT_PAYWALL_THRESHOLD;
/** @deprecated Use runtime membership settings where available. */
export const FREE_STAGE_GOAL_MEMBERS = DEFAULT_PAYWALL_THRESHOLD;
export const WATCH_LIMITS = { free_stage: 30, registered: 3, pro: 90 } as const;
export const CRYPTO_PASS_PRICE_USD = 416;
export const CRYPTO_PASS_PRICE_HKD = 3244.8;
export const CRYPTO_PASS_DISCOUNT = 0.8;
export function formatHkd(amount: number) {
  return `HK$${amount.toLocaleString('en-HK', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}
export const PRO_WEEKLY_PRICE_HKD = 78;
export const FOUNDING_PRO_WEEKS = 52;
export const FOUNDING_PRO_VALUE_HKD = PRO_WEEKLY_PRICE_HKD * FOUNDING_PRO_WEEKS;
export const FREE_STAGE_PRO_FEATURE_ACCESS = true;

/** 免費階段進度（百分比，上限 100）；門檻未達之前全站免費，唔會悄悄收費。 */
export function freeStageProgress(total: number, goal = FREE_STAGE_GOAL_MEMBERS) {
  if (!Number.isFinite(total) || total <= 0 || goal <= 0) return 0;
  return Math.min(100, Math.round((total / goal) * 1000) / 10);
}
