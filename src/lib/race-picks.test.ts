import { describe, expect, it } from "vitest";
import { racePicksFromDay } from "./race-picks";

const day = {
  date: "2026-10-21",
  venue: "ST",
  races: [
    { raceNumber: 1, picks: [{ horseNumber: 3, rank: 1 }] },
    { raceNumber: 11, picks: [{ horseNumber: 7, rank: 1 }] },
  ],
};

describe("單場頁預測只用已核實凍結版", () => {
  it("同日同馬場先返回該場凍結首選", () => {
    expect(racePicksFromDay(day, "2026-10-21", "ST", 11)).toEqual([{ horseNumber: 7, rank: 1 }]);
  });

  it("日期或馬場唔吻合即返回空，唔會採用其他賽日資料", () => {
    expect(racePicksFromDay(day, "2026-10-25", "ST", 11)).toEqual([]);
    expect(racePicksFromDay(day, "2026-10-21", "HV", 11)).toEqual([]);
    expect(racePicksFromDay(null, "2026-10-21", "ST", 11)).toEqual([]);
    expect(racePicksFromDay({ date: "2026-10-21", venue: "ST" }, "2026-10-21", "ST", 11)).toEqual([]);
  });
});
