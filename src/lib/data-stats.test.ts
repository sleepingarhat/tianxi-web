import { describe, expect, it } from "vitest";
import { dataScaleSentence, fmtCount, fmtWan, parseDataStats } from "./data-stats";

const sample = {
  ok: true,
  schemaVersion: 1,
  source: "d1",
  generatedAt: "2026-10-22T22:00:00.000Z",
  range: { first: "2016-01-01", last: "2026-10-21" },
  counts: { raceDays: 944, races: 8903, runnerResults: 113136, horses: 6111, sectionals: null },
  latest: { results: "2026-10-21" },
  missing: ["horse_sectional_times"],
};

describe("數據量（D1 唯一來源）", () => {
  it("格式化：千位分隔、萬位、缺值顯示—", () => {
    expect(fmtCount(113136)).toBe("113,136");
    expect(fmtCount(null)).toBe("—");
    expect(fmtCount(undefined)).toBe("—");
    expect(fmtWan(113136)).toBe("11.3 萬");
    expect(fmtWan(9590)).toBe("9,590");
    expect(fmtWan(null)).toBe("—");
  });
  it("只接受 D1 schemaVersion 1；錯誤或異常回應一律當冇數", () => {
    expect(parseDataStats(sample)?.counts.runnerResults).toBe(113136);
    expect(parseDataStats({ ok: false, error: "data-stats-unavailable" })).toBeNull();
    expect(parseDataStats({ ...sample, schemaVersion: 2 })).toBeNull();
    expect(parseDataStats({ ...sample, source: "csv" })).toBeNull();
    expect(parseDataStats({ ...sample, counts: { raceDays: "944" } })).toBeNull();
    expect(parseDataStats({ ...sample, counts: { raceDays: -1 } })).toBeNull();
    expect(parseDataStats(null)).toBeNull();
  });
  it("文案：有數先寫數，冇數唔會出舊數字", () => {
    expect(dataScaleSentence(parseDataStats(sample))).toContain(
      "944 個賽馬日、8,903 場賽事、113,136 行",
    );
    const fallback = dataScaleSentence(null);
    expect(fallback).not.toMatch(/\d/);
  });
});
