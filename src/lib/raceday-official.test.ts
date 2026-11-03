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

import { normalizeChallenge } from "./raceday-official";
describe("normalizeChallenge", () => {
  const pools = [{ kind: "JKC", status: "PAYOUTSTARTED", races: "1,2,3" }];
  const rows = [
    { kind: "JKC", name: "田泰安", odds: "6.50", finalOrder: 2, points: "28.0", isOther: 0 },
    { kind: "JKC", name: "何澤堯", odds: "1.08", finalOrder: 1, points: "44.0", isOther: 0 },
    { kind: "JKC", name: "巫顯東", odds: null, finalOrder: null, points: "18.0", isOther: 1 },
    { kind: "JKC", name: "潘明輝", odds: "9999", finalOrder: 5, points: "0.0", isOther: 0 },
  ];
  it("orders by official final order and drops the 其他 members", () => {
    const b = normalizeChallenge(pools, rows)[0]!;
    expect(b.rows.map((r) => r.name)).toEqual(["何澤堯", "田泰安", "潘明輝"]);
    expect(b.rows[0]!.points).toBe(44);
  });
  it("hides the 9999 placeholder instead of showing it as odds", () => {
    expect(normalizeChallenge(pools, rows)[0]!.rows[2]!.odds).toBeNull();
  });
  it("omits a pool the official page has not published", () => {
    expect(normalizeChallenge([], rows)).toEqual([]);
  });
});

describe("normalizeHeadlines", () => {
  it("lists every stored meeting newest first and drops rows without identity", async () => {
    const { normalizeHeadlines } = await import("./raceday-official");
    const rows = normalizeHeadlines([
      { date: "2026-11-01", venue: "HV", version: 1, title: "舊頭條", lead: "" },
      { date: "2026-11-04", venue: "HV", version: 2, title: "猛男複製輝煌戰績", lead: "姚本輝" },
      { date: "2026-11-04", venue: "XX", title: "壞場地" },
      { date: "bad", venue: "ST", title: "壞日期" },
    ]);
    expect(rows.map((r) => [r.date, r.title, r.version])).toEqual([["2026-11-04", "猛男複製輝煌戰績", 2], ["2026-11-01", "舊頭條", 1]]);
    expect(rows[1]?.lead).toBeNull();
  });
});
