import { describe, expect, it } from "vitest";
import { FREE_STAGE_GOAL_MEMBERS, DEFAULT_PAYWALL_THRESHOLD, FOUNDING_SLOTS, WATCH_LIMITS, CRYPTO_PASS_PRICE_USD, CRYPTO_PASS_PRICE_HKD, CRYPTO_PASS_DISCOUNT, formatHkd, PRO_WEEKLY_PRICE_HKD, FOUNDING_PRO_WEEKS, FOUNDING_PRO_VALUE_HKD, FREE_STAGE_PRO_FEATURE_ACCESS } from "./freeStage";
describe("Pro 免費階段規則", () => {
  it("200名會員開閘", () => expect(FREE_STAGE_GOAL_MEMBERS).toBe(200));
  it("創始名額共用門檻", () => expect(FOUNDING_SLOTS).toBe(DEFAULT_PAYWALL_THRESHOLD));
  it("閘前可追蹤30匹", () => expect(WATCH_LIMITS.free_stage).toBe(30));
  it("閘後免費可追蹤3匹", () => expect(WATCH_LIMITS.registered).toBe(3));
  it("Pro可追蹤90匹", () => expect(WATCH_LIMITS.pro).toBe(90));
  it("加密52週價US$416", () => expect(CRYPTO_PASS_PRICE_USD).toBe(416));
  it("八折港元價3244.80", () => {expect(CRYPTO_PASS_PRICE_HKD).toBe(3244.8);expect(CRYPTO_PASS_DISCOUNT).toBe(0.8);expect(FOUNDING_PRO_VALUE_HKD * CRYPTO_PASS_DISCOUNT).toBeCloseTo(3244.8);expect(formatHkd(CRYPTO_PASS_PRICE_HKD)).toBe('HK$3,244.80');});
  it("Pro每星期HK$78", () => expect(PRO_WEEKLY_PRICE_HKD).toBe(78));
  it("一年免費會籍為52週", () => expect(FOUNDING_PRO_WEEKS).toBe(52));
  it("免費會籍總值HK$4056", () => expect(FOUNDING_PRO_VALUE_HKD).toBe(4056));
  it("免費階段享有Pro功能", () => expect(FREE_STAGE_PRO_FEATURE_ACCESS).toBe(true));
});