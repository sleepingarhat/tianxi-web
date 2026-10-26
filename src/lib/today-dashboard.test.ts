import { describe, expect, it } from "vitest";
import {
  actualTop4FromPicks,
  hkCalendarDate,
  isMeetingToday,
  LAB_TOOLS,
  lockPhase,
  lockStatusLabel,
  modelMarketGapPp,
  pickFocusRace,
  raceStartMs,
  rankedPicks,
  top4HitCount,
  venueLabel,
} from "./today-dashboard";

describe("today-dashboard", () => {
  it("香港日曆日用 Asia/Hong_Kong", () => {
    expect(hkCalendarDate(new Date("2026-10-25T16:30:00Z"))).toBe("2026-10-26");
    expect(isMeetingToday("2026-10-26", new Date("2026-10-25T16:30:00Z"))).toBe(true);
    expect(isMeetingToday("2026-10-25", new Date("2026-10-25T16:30:00Z"))).toBe(false);
  });

  it("解析香港牆鐘開跑時間", () => {
    expect(raceStartMs("13:15", "2026-10-26")).toBe(Date.parse("2026-10-26T13:15:00+08:00"));
    expect(raceStartMs("bad", "2026-10-26")).toBeNull();
  });

  it("揀而家／下一場／完場後最後一場", () => {
    const races = [
      { raceNumber: 1, startTime: "13:00" },
      { raceNumber: 2, startTime: "13:30" },
      { raceNumber: 3, startTime: "14:00", settled: true },
    ];
    const before = Date.parse("2026-10-26T12:50:00+08:00");
    expect(pickFocusRace(races, "2026-10-26", before)?.kind).toBe("next");
    expect(pickFocusRace(races, "2026-10-26", before)?.race.raceNumber).toBe(1);

    const during = Date.parse("2026-10-26T13:03:00+08:00");
    expect(pickFocusRace(races, "2026-10-26", during)?.kind).toBe("current");
    expect(pickFocusRace(races, "2026-10-26", during)?.race.raceNumber).toBe(1);

    const between = Date.parse("2026-10-26T13:20:00+08:00");
    expect(pickFocusRace(races, "2026-10-26", between)?.kind).toBe("next");
    expect(pickFocusRace(races, "2026-10-26", between)?.race.raceNumber).toBe(2);

    const after = Date.parse("2026-10-26T15:00:00+08:00");
    expect(pickFocusRace(races, "2026-10-26", after)?.kind).toBe("last");
  });

  it("鎖定狀態標籤：初版／倒數／已鎖／副本／未能核實", () => {
    expect(lockPhase({ isLoading: true })).toBe("loading");
    expect(lockPhase({ publicationPending: true })).toBe("pending");
    expect(lockPhase({ edition: "unavailable" })).toBe("unavailable");
    expect(lockPhase({ frozen: true })).toBe("locked");
    const lockAt = "2026-10-26T05:10:00.000Z"; // 13:10 HKT
    const before = Date.parse("2026-10-26T04:40:00.000Z");
    expect(lockPhase({ lockAt, nowMs: before, edition: "draft" })).toBe("countdown");
    expect(lockStatusLabel("countdown", lockAt, before)).toMatch(/^T−90 倒數 00:30:/);
    expect(lockStatusLabel("locked")).toBe("已鎖");
    expect(lockStatusLabel("draft")).toBe("初版");
    expect(lockStatusLabel("pending")).toBe("正在建立凍結副本");
    expect(lockStatusLabel("unavailable")).toBe("預測暫未能核實");
  });

  it("rankedPicks 按 rank 取前五", () => {
    const picks = [
      { horseNumber: 3, rank: 3 },
      { horseNumber: 1, rank: 1 },
      { horseNumber: 2, rank: 2 },
      { horseNumber: 5, rank: 5 },
      { horseNumber: 4, rank: 4 },
      { horseNumber: 6, rank: 6 },
    ];
    expect(rankedPicks(picks, 5).map((p) => p.horseNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  it("模型 vs 市場差距以除水機率計 pp", () => {
    const field = [
      { horseNumber: 1, pWin: 0.4, winOdds: 2 },
      { horseNumber: 2, pWin: 0.3, winOdds: 4 },
      { horseNumber: 3, pWin: 0.2, winOdds: 5 },
      { horseNumber: 4, pWin: 0.1, winOdds: 10 },
    ];
    // 1/odds: 0.5 + 0.25 + 0.2 + 0.1 = 1.05；馬1 市場 = 0.5/1.05
    const gap = modelMarketGapPp(field[0], field);
    expect(gap).not.toBeNull();
    expect(gap!).toBeCloseTo((0.4 - 0.5 / 1.05) * 100, 5);
    expect(modelMarketGapPp(field[0], [{ winOdds: 2 }])).toBeNull();
  });

  it("四揀命中與 finishingPosition 推頭四", () => {
    expect(top4HitCount([{ horseNumber: 1 }, { horseNumber: 2 }, { horseNumber: 3 }, { horseNumber: 4 }], [1, 5, 3, 8])).toBe(2);
    expect(top4HitCount([{ horseNumber: 1 }], [1, 2, 3, 4])).toBeNull();
    const picks = [
      { horseNumber: 7, finishingPosition: 2 },
      { horseNumber: 1, finishingPosition: 1 },
      { horseNumber: 3, finishingPosition: 4 },
      { horseNumber: 9, finishingPosition: 3 },
      { horseNumber: 2, finishingPosition: 5 },
    ];
    expect(actualTop4FromPicks(picks)).toEqual([1, 7, 9, 3]);
  });

  it("venueLabel 同研究室六工具位外殼", () => {
    expect(venueLabel("ST")).toBe("沙田");
    expect(venueLabel("HV")).toBe("跑馬地");
    expect(LAB_TOOLS).toHaveLength(6);
    expect(LAB_TOOLS.every((t) => t.status === "soon" || t.status === "locked")).toBe(true);
    expect(LAB_TOOLS.some((t) => t.status === "ready")).toBe(false);
  });
});
