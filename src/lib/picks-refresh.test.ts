import { describe, expect, it, vi } from "vitest";
import { createPicksRefresh, picksEdition, editionAfterError } from "./picks-refresh";
import { raceStatus } from "./prediction-status";

describe("今日預測最終版讀取", () => {
  it("掛起讀取55秒後停止，重試不能被舊請求卡住或回填", async () => {
    vi.useFakeTimers();
    try {
      let finishOld: ((value: { edition: string }) => void) | undefined;
      const upstream = vi.fn()
        .mockImplementationOnce(() => new Promise<{ edition: string }>(resolve => { finishOld = resolve; }))
        .mockResolvedValueOnce({ edition: "final" });
      const refresh = createPicksRefresh(upstream);
      const failed = expect(refresh()).rejects.toThrow("timeout");
      await vi.advanceTimersByTimeAsync(55_000);
      await failed;
      expect(await refresh()).toEqual({ edition: "final" });
      finishOld?.({ edition: "draft" });
      await Promise.resolve();
      expect(upstream).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
  it("重新讀取不沿用初版，全11場讀回最終版", async () => {
    const upstream = vi.fn().mockResolvedValueOnce({ frozen: false, edition: "draft" }).mockResolvedValueOnce({ frozen: true, edition: "final", races: Array.from({ length: 11 }, (_, i) => ({ raceNumber: i + 1 })) });
    const refresh = createPicksRefresh<any>(upstream);
    expect(picksEdition(await refresh())).toBe("draft");
    const final = await refresh();
    expect(picksEdition(final)).toBe("final");
    expect(final.races).toHaveLength(11);
    expect(upstream).toHaveBeenCalledTimes(2);
  });
  it("同時請求合併，完成後重新讀取", async () => {
    const upstream = vi.fn().mockResolvedValue({ frozen: true });
    const refresh = createPicksRefresh<any>(upstream);
    await Promise.all([refresh(), refresh()]);
    expect(upstream).toHaveBeenCalledTimes(1);
    await refresh();
    expect(upstream).toHaveBeenCalledTimes(2);
  });
  it("上游失敗不回舊版，之後可重試", async () => {
    const upstream = vi.fn().mockResolvedValueOnce({ frozen: false }).mockRejectedValueOnce(new Error("凍結紀錄不完整")).mockResolvedValueOnce({ frozen: true });
    const refresh = createPicksRefresh<any>(upstream);
    await refresh();
    await expect(refresh()).rejects.toThrow("凍結紀錄不完整");
    expect(picksEdition(await refresh())).toBe("final");
  });
  it("確認final，矛盾或unavailable不冒充最終版", () => {
    expect(picksEdition({ edition: "final" })).toBe("final");
    expect(picksEdition({ frozen: true })).toBe("final");
    expect(picksEdition({ edition: "unavailable", frozen: true })).toBe("unavailable");
    expect(picksEdition({ edition: "final", frozen: false })).toBe("draft");
  });
  it("無開跑時間也按預測凍結狀態顯示，不用時間代證", () => {
    const race = { raceNumber: 1, scoreSource: "lgb", picks: [{ horseNumber: 4, pWin: 0.202 }] };
    const now = new Date("2026-10-19T05:36:00Z");
    expect(raceStatus(race, { date: "2026-10-19", now, frozen: true }).color).toBe("green");
    expect(raceStatus({ ...race, startTime: "12:30" }, { date: "2026-10-19", now, frozen: false }).color).toBe("amber");
  });
  it("背景重讀失敗：鎖前保留上一份初版，鎖後或最終版一律不可用", () => {
    const lockAt = "2026-10-21T09:10:00.000Z";
    const before = Date.parse("2026-10-21T08:00:00Z");
    const after = Date.parse("2026-10-21T09:11:00Z");
    expect(editionAfterError({ edition: "draft", lockAt }, true, before)).toBe("draft");
    expect(editionAfterError({ edition: "draft", lockAt }, true, after)).toBe("unavailable");
    expect(editionAfterError({ edition: "final", lockAt }, true, before)).toBe("unavailable");
    expect(editionAfterError(undefined, true, before)).toBe("unavailable");
    expect(editionAfterError({ edition: "draft" }, true, before)).toBe("unavailable");
  });
});
