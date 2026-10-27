import { describe, expect, it } from "vitest";
import { bestDraws, changeCountByRace, normalizeArchivedChanges, normalizeDrawStats, normalizeRanking } from "./raceday-official";

describe("raceday official", () => {
  it("ranking splits roles, sorts by rank and caps at 5", () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({ role: "jockey", rank: 7 - i, name: `J${7 - i}`, wins: i, starts: 10, asOf: "2026-10-25", season: "26/27" }));
    const r = normalizeRanking([...rows, { role: "trainer", rank: 1, name: "T", wins: 3, starts: 9 }, { role: "x", rank: 1, name: "bad", wins: 1, starts: 1 }]);
    expect(r.jockey.map((x) => x.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(r.trainer).toHaveLength(1);
    expect(r.asOf).toBe("2026-10-25");
  });
  it("best draws ignore samples under 20 starts", () => {
    const d = normalizeDrawStats([
      { raceNumber: 1, draw: 1, starts: 69, winPct: 9, placePct: 29 },
      { raceNumber: 1, draw: 2, starts: 10, winPct: 40, placePct: 50 },
      { raceNumber: 1, draw: 3, starts: 68, winPct: 12, placePct: 19 },
      { raceNumber: 1, draw: 4, starts: 5, winPct: 101, placePct: 1 },
    ]);
    expect(d).toHaveLength(3);
    expect(bestDraws(d, 1).map((x) => x.draw)).toEqual([3, 1]);
  });
  it("counts archived changes per race", () => {
    const c = normalizeArchivedChanges([{ raceNumber: 2, changeType: "騎師" }, { raceNumber: 2, changeType: "退出" }, { raceNumber: 0, changeType: "x" }]);
    expect(changeCountByRace(c).get(2)).toBe(2);
    expect(c).toHaveLength(2);
  });
});
