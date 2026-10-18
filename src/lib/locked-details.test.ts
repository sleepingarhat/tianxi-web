import { describe, expect, it } from "vitest";
import { LOCKED_FACTORS, parseLockedFactors } from "./locked-details";

describe("鎖點原值", () => {
  it("保留8項原值，只標實際使用項目", () => {
    const data = parseLockedFactors('{"draw":0.963,"weight":0,"recency":10,"used":["draw","weight"]}');
    expect(LOCKED_FACTORS).toHaveLength(8);
    expect(data?.scores.draw).toBe(0.963);
    expect(data?.scores.weight).toBe(0);
    expect(data?.used).toEqual(["draw", "weight"]);
  });
  it("缺值不推算或補零", () => {
    expect(parseLockedFactors('{"draw":2}')?.scores.injury).toBeNull();
    expect(parseLockedFactors(null)).toBeNull();
  });
  it("損壞資料不冒充有效原值", () => {
    expect(parseLockedFactors('broken')).toBeNull();
    expect(parseLockedFactors('{"weight":"3"}')?.scores.weight).toBeNull();
  });
});