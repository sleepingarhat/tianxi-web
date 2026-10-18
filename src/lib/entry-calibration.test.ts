import { describe, expect, it } from "vitest";
import { entryVsActual } from "./entry-calibration";

describe("入場排名 vs 實際成績", () => {
  const picks = [
    { horseNumber: 1, pTop4: 0.6 },
    { horseNumber: 2, pTop4: 0.5 },
    { horseNumber: 3, pTop4: 0.4 },
    { horseNumber: 4, pTop4: 0.3 },
    { horseNumber: 5, pTop4: 0.2 },
  ];
  it("頭四入場排名預期 1.8 匹，實際按名次 ≤4 計", () => {
    const r = entryVsActual(picks, { "1": 1, "2": 6, "3": 3, "4": 5, "5": 2 });
    expect(r.expectedTop).toBeCloseTo(1.8);
    expect(r.actualTop).toBe(2);
    expect(r.actualAll).toBe(3);
  });
  it("未有賽果嘅馬唔計入", () => {
    const r = entryVsActual(picks, { "1": 1 });
    expect(r.rows.length).toBe(1);
    expect(r.expectedAll).toBeCloseTo(0.6);
  });
});
