import { describe, expect, it } from "vitest";
import { dayStatus, raceStatus } from "./prediction-status";

const now = new Date("2026-10-19T06:15:00Z");
const race = {
  raceNumber: 1,
  startTime: "12:30",
  scoreSource: "lgb",
  picks: Array.from({ length: 14 }, (_, i) => ({ horseNumber: i + 1, rank: i + 1, lgbScore: 14 - i })),
};

describe("少仗不排除正式預測", () => {
  it("四揀有1匹少仗馬，已凍結場次仍為正式綠燈，原分數排名不變", () => {
    const original = structuredClone(race);
    const status = raceStatus(race, { date: "2026-10-19", now, frozen: true, scarceStarts: 1 });
    expect(status.color).toBe("green");
    expect(status.scarceStarts).toBe(1);
    expect(status.lgbCovered).toBe(14);
    expect(race).toEqual(original);
  });
  it("四揀全部少仗仍不排除全日正式場次", () => {
    const status = dayStatus([race], "2026-10-19", now, { 1: 4 });
    expect(status.green).toBe(1);
    expect(status.red).toBe(0);
    expect(status.total).toBe(1);
  });
  it("少仗不讓未凍結場次變正式", () => {
    expect(raceStatus(race, { date: "2026-10-19", now, frozen: false, scarceStarts: 1 }).color).toBe("amber");
  });
  it("少仗不豁免缺預測資料的阻截", () => {
    expect(raceStatus({ ...race, picks: [] }, { frozen: true, scarceStarts: 1 }).color).toBe("red");
  });
});