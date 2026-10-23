import { describe, expect, it } from "vitest";
import { tierHas } from "./tiers";
describe("會員分級權限", () => {
  it("遊客不可讀會員資料", () => expect(tierHas("guest","registered")).toBe(false));
  it("免費會員不可讀Pro資料", () => expect(tierHas("registered","pro")).toBe(false));
  it("Pro可讀會員資料", () => expect(tierHas("pro","registered")).toBe(true));
});