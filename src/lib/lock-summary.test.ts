import { describe, expect, it } from "vitest";
import { lockSummary } from "./lock-summary";

describe("lockSummary", () => {
  it("no-fixture day shows 今日無賽事, never undefined", () => {
    const s = lockSummary({ locked: false, source: "no-fixture" });
    expect(s.value).toBe("今日無賽事");
    expect(s.sub).toBe("—");
  });
  it("race day before lock shows 未鎖 with the date", () => {
    expect(lockSummary({ locked: false, date: "2026-11-25", frozenRows: 0 }).value).toBe("未鎖");
    expect(lockSummary({ locked: false, date: "2026-11-25", frozenRows: 0 }).sub).toBe("2026-11-25 · 0 行凍結");
  });
  it("locked race day shows 已鎖", () => {
    expect(lockSummary({ locked: true, date: "2026-11-25", frozenRows: 130 }).value).toBe("已鎖");
  });
});
