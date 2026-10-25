import { describe, expect, it } from "vitest";
import { actualStages, coverageRows, distanceBand, historicalPositions, marketCoverage, parseResultsCsv, summarizeCoverage, type AuditRace } from "./racing-visibility";
const race: AuditRace = { raceNumber: 1, distance: 1650, scoreSource: "oracle (frozen)", predictedTop4: [1, 2, 3, 4].map(horseNumber => ({ horseNumber })), actualTop4: [1, 3, 5, 6].map((horseNumber, i) => ({ horseNumber, position: i + 1 })) };
describe("read-only coverage rules", () => {
  it("rejects invalid prelock inputs and alternative selections masquerading as originals", () => {
    const invalid = { ...race, withdrawal: { status: 'invalid-prelock-input' } };
    const alternative = { ...race, originalTop4: [1,2,3,5] };
    expect(coverageRows({ date: '2026-10-19', venue: 'ST', races: [invalid, alternative] }, new Map())).toEqual([]);
  });
  it("uses the requested 1200, 1650 and 2000 metre boundaries", () => {
    expect([1200, 1201, 1650, 1651, 2000, 2001].map(distanceBand)).toEqual(["短途", "一哩", "一哩", "中長", "中長", "長途"]);
  });
  it("compares all starters' closing odds, not only winning horses", () => {
    expect(marketCoverage(race, [2, 4, 5, 6, 1, 3].map((no, i) => ({ no, place: i + 1, odds: i + 2 })))).toBe(2);
  });
  it("does not claim a market comparison with a missing closing price", () => {
    expect(marketCoverage(race, [1, 2, 3, 4, 5].map((no, i) => ({ no, place: i + 1, odds: i === 4 ? null : i + 2 })))).toBeNull();
  });
  it("excludes an ambiguous fourth favourite tie", () => {
    expect(marketCoverage(race, [1, 2, 3, 4, 5].map((no, i) => ({ no, place: i + 1, odds: i < 3 ? i + 2 : 8 })))).toBeNull();
  });
  it("excludes non-frozen and incomplete predictions", () => {
    expect(coverageRows({ date: "2026-10-14", venue: "HV", races: [{ ...race, scoreSource: "lgb" }, { ...race, predictedTop4: [{ horseNumber: 1 }] }] }, new Map())).toEqual([]);
  });
  it("uses identical paired denominators and keeps missing data visible", () => {
    const summary = summarizeCoverage([{ date: "2026-10-14", venue: "HV", raceNo: 1, band: "一哩", model: 2, market: 3 }, { date: "2026-10-14", venue: "HV", raceNo: 2, band: "一哩", model: 4, market: null }]);
    expect(summary).toMatchObject({ n: 2, paired: 1, missing: 1, model: 3, pairedModel: 2, market: 3 });
  });
  it("reads quoted CSV and ignores scratched result positions", () => {
    const rows = parseResultsCsv('race_no,horse_no,place,win_odds,name\n1,2,1,3.5,"a,b"\n1,4,WD,,horse\n');
    expect(rows.get(1)).toEqual([{ no: 2, place: 1, odds: 3.5 }, { no: 4, place: null, odds: null }]);
  });
});
describe("historical running positions", () => {
  it('連字號走位計入歷史並排除終點', () => {
    expect(actualStages('1-1-2')).toEqual([1,1,1]);
    const summary = historicalPositions([{ date:'2026-10-20', distance:1200, runningPosition:'1-1-2' }, { date:'2026-10-10', distance:1200, runningPosition:'2 3 4' }, { date:'2026-10-01', distance:1200, runningPosition:'3-2-1' }], '2026-10-25',1200);
    expect(summary.n).toBe(3);
    expect(summary.last).toBe('2026-10-20');
  });
  it("excludes same-day and future results before the race cutoff", () => {
    const summary = historicalPositions([{ date: "2026-10-13", distance: 1650, runningPosition: "5 3 3 1" }, { date: "2026-10-14", distance: 1650, runningPosition: "1 1 1 1" }, { date: "2026-10-15", distance: 1650, runningPosition: "2 2 2 2" }], "2026-10-14", 1650);
    expect(summary.n).toBe(1); expect(summary.stages.map(s => s.mid)).toEqual([5, 3, 3]);
  });
  it("prioritizes the current distance band and excludes finishing position", () => {
    const summary = historicalPositions([{ date: "2026-10-13", distance: 1000, runningPosition: "1 1 1" }, { date: "2026-10-12", distance: 1800, runningPosition: "5 3 3 1" }], "2026-10-14", 1800);
    expect(summary).toMatchObject({ n: 1, sameBand: true }); expect(summary.stages[2]?.mid).toBe(3);
  });
  it("reads actual race checkpoints with the same stages and without the finish", () => {
    expect(actualStages("6 6 5 4")).toEqual([6, 6, 5]);
    expect(actualStages("8 7")).toEqual([8, 8, 8]);
    expect(actualStages("WV")).toBeNull();
  });
});import { valueRace as _vr, summarizeValue as _sv } from "./racing-visibility";
describe("engine value comparison", () => {
  const runners = [1,2,3,4,5,6].map(no => ({ no, odds: [2,3,4,5,8.5,12][no-1]!, place: [5,6,1,7,2,3][no-1]! }));
  const race = { raceNumber: 1, predictedTop4: [5,6,3,1].map(horseNumber => ({ horseNumber })) };
  it("averages odds of engine picks that finished top 4 only", () => {
    const v = _vr(race, runners)!;
    expect(v.engineHits).toBe(3); expect(v.engineOdds).toEqual([8.5, 12, 4]);
    expect(v.marketHits).toBe(1); expect(v.marketOdds).toEqual([4]);
  });
  it("odds edge is engine minus market, hit gap is market minus engine", () => {
    const s = _sv([_vr(race, runners)!]);
    expect(s.oddsEdge).toBeCloseTo(8.1667 - 4, 3); expect(s.hitGap).toBe(-2);
  });
});
