/** 免費階段商業路線（用戶 2026-10-13 拍板）：登記帳戶累積至門檻先出 iOS App 同開始收費。
 *  呢檔係瀏覽器安全模組，首頁路線圖、會員頁同監控端都讀同一個數，改呢度即全站跟住改。 */
export const DEFAULT_PAYWALL_THRESHOLD = 200;
/** Client fallback only; runtime threshold/cap comes from membership RPCs. */
export const FOUNDING_SLOTS = DEFAULT_PAYWALL_THRESHOLD;
/** @deprecated Use runtime membership settings where available. */
export const FREE_STAGE_GOAL_MEMBERS = DEFAULT_PAYWALL_THRESHOLD;
export const WATCH_LIMITS = { free_stage: 30, registered: 3, pro: 90 } as const;
export const CRYPTO_PASS_PRICE_USD = 416;
export const CRYPTO_PASS_APPROX_HKD = 3245;
export const PRO_WEEKLY_PRICE_HKD = 78;
export const FOUNDING_PRO_WEEKS = 52;
export const FOUNDING_PRO_VALUE_HKD = PRO_WEEKLY_PRICE_HKD * FOUNDING_PRO_WEEKS;
export const FREE_STAGE_PRO_FEATURE_ACCESS = true;

/** 免費階段進度（百分比，上限 100）；門檻未達之前全站免費，唔會悄悄收費。 */
export function freeStageProgress(total: number, goal = FREE_STAGE_GOAL_MEMBERS) {
  if (!Number.isFinite(total) || total <= 0 || goal <= 0) return 0;
  return Math.min(100, Math.round((total / goal) * 1000) / 10);
}
