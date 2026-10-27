import { describe, expect, it } from "vitest";
import { normalizeRaceHeaders, prizeText, ratingText, trackText } from "./race-header";

describe("race header", () => {
  it("normalizes official 10-28 R1 header", () => {
    const [r] = normalizeRaceHeaders([{ raceNumber: 1, raceName: "畫眉山讓賽", prize: "875000", ratingRange: "40-0", track: "全天候", course: null, distance: 1650 }]);
    expect(r?.prize).toBe(875000);
    expect(prizeText(r!.prize)).toBe("HK$875,000");
    expect(ratingText(r!.ratingRange)).toBe("官方評分 40-0");
    expect(trackText(r!)).toBe("全天候");
  });
  it("drops invalid race numbers and blank prize", () => {
    const rows = normalizeRaceHeaders([{ raceNumber: 0 }, { raceNumber: 3, prize: "" }]);
    expect(rows.map((r) => r.raceNumber)).toEqual([3]);
    expect(rows[0]?.prize).toBeNull();
  });
  it("adds 跑道 suffix to turf course", () => {
    expect(trackText({ track: "草地", course: "C+3" })).toBe("草地 · C+3 跑道");
  });
});
