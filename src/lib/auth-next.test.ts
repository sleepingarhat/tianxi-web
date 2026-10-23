import { describe, expect, it } from "vitest";
import { safeAuthNext } from "./auth-next";
describe("登入後安全回跳", () => {
  it("保留本網站賽馬頁", () => expect(safeAuthNext("/predictor?date=2026-10-21")).toBe("/predictor?date=2026-10-21"));
  it("拒絕外站", () => expect(safeAuthNext("https://example.com")).toBeUndefined());
  it("拒絕雙斜線外站", () => expect(safeAuthNext("//example.com")).toBeUndefined());
  it("拒絕反斜線外站", () => expect(safeAuthNext("/\\example.com")).toBeUndefined());
  it("拒絕登入循環", () => expect(safeAuthNext("/auth?mode=signup")).toBeUndefined());
  it("拒絕工作端點", () => expect(safeAuthNext("/api/public/jobs/racing-results")).toBeUndefined());
});