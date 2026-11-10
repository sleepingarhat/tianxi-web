import { describe, expect, it } from "vitest";

import { scheduleMonthTicker } from "./schedule-month";

describe("賽程月份條", () => {
  it("查詢未完成時唔顯示 0 個賽馬日", () => {
    expect(
      scheduleMonthTicker({ ym: "2026-11", pending: true, failed: false, meetingCount: 0 }),
    ).toBe("2026-11 · 讀取賽馬日…");
  });

  it("成功載入後先顯示實數，包括真正沒有賽馬日", () => {
    expect(
      scheduleMonthTicker({ ym: "2026-11", pending: false, failed: false, meetingCount: 4 }),
    ).toBe("2026-11 · 4 個賽馬日");
    expect(
      scheduleMonthTicker({ ym: "2026-11", pending: false, failed: false, meetingCount: 0 }),
    ).toBe("2026-11 · 0 個賽馬日");
  });

  it("讀取失敗時唔把空清單當成零個賽馬日", () => {
    expect(
      scheduleMonthTicker({ ym: "2026-11", pending: false, failed: true, meetingCount: 0 }),
    ).toBe("2026-11 · 賽馬日暫未能讀取");
  });

  it("停賽通告優先於月份計數", () => {
    expect(
      scheduleMonthTicker({
        ym: "2026-11",
        cancellationText: "2026年11月14日 · 今日賽事停賽",
        pending: true,
        failed: false,
        meetingCount: 0,
      }),
    ).toBe("2026年11月14日 · 今日賽事停賽");
  });
});
