import { describe, expect, it } from "vitest";
import { crossRaceDividends, dividendsByRace, normalizeDividends, normalizeMeetings, normalizePoolStatus, per10, summarizeStatus } from "./official-pools";

const div = (o: Record<string, unknown>) => ({ pool: "WIN", leg: 9, races: "9", kind: "Winning", seq: 1, combo: "8", amount: "389", partial: 0, partialUnit: 0, status: "OFFICIAL", ...o });

describe("official pools", () => {
  it("四重彩每 $1 部分單位派彩換算為每 $10", () => {
    expect(per10(235071.2, true, 1)).toBe(2350712);
    const [r] = normalizeDividends([div({ pool: "QTT", combo: "14,10,9,12", amount: "235071.2", partial: 1, partialUnit: 1 })]);
    expect(r!.per10).toBe(2350712);
    expect(r!.partialUnit).toBe(1);
  });

  it("非部分單位派彩照原額", () => {
    expect(normalizeDividends([div({})])[0]!.per10).toBe(389);
  });

  it("單位無效或非正式派彩唔顯示", () => {
    expect(normalizeDividends([div({ partial: 1, partialUnit: 0 })])).toHaveLength(0);
    expect(normalizeDividends([div({ status: "PROVISIONAL" })])).toHaveLength(0);
    expect(normalizeDividends([div({ races: "0" })])).toHaveLength(0);
  });

  it("單場同跨場彩池分開", () => {
    const rows = normalizeDividends([div({}), div({ pool: "PLA", seq: 2, combo: "6", amount: "12.5" }), div({ pool: "DBL", leg: 8, races: "8,9", combo: "7/8", amount: "6637.5" })]);
    const byRace = dividendsByRace(rows);
    expect(byRace).toHaveLength(1);
    expect(byRace[0]!.pools.map((p) => p.pool)).toEqual(["WIN", "PLA"]);
    expect(crossRaceDividends(rows).map((r) => r.pool)).toEqual(["DBL"]);
  });

  it("彩池狀態按種類計停售場數，跨場彩池逐關保留", () => {
    const s = summarizeStatus(normalizePoolStatus([
      { pool: "WIN", leg: 1, races: "1", status: "STOP_SELL" },
      { pool: "WIN", leg: 2, races: "2", status: "START_SELL" },
      { pool: "DT", leg: 5, races: "10,11", status: "STOP_SELL", jackpot: "300000.00", estimated: "4000000" },
    ]));
    expect(s.pools[0]!.counts).toEqual({ STOP_SELL: 1, START_SELL: 1 });
    expect(s.pools[1]!.legs).toBe(1);
    expect(s.featured[0]!.jackpot).toBe(300000);
  });

  it("賽日清單最新排先、去重", () => {
    expect(normalizeMeetings([{ date: "2026-11-01", venue: "HV" }, { date: "2026-11-08", venue: "ST" }, { date: "2026-11-08", venue: "ST" }, { date: "bad", venue: "ST" }]))
      .toEqual([{ date: "2026-11-08", venue: "ST" }, { date: "2026-11-01", venue: "HV" }]);
  });
});
