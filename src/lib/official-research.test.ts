import { describe, expect, it } from "vitest";
import { officialMeetingDate, officialHorseBrand, projectOfficialRows, HORSE_OFFICIAL_FIELDS } from "./official-research";
describe("official-only public reference", () => {
  it("rejects impossible meeting dates", () => {
    expect(officialMeetingDate("2026-10-28")).toBe("2026-10-28");
    expect(() => officialMeetingDate("2026-02-30")).toThrow();
  });
  it("matches the horse brand without guessing its import year", () => {
    expect(officialHorseBrand("horse_J218")).toBe("J218");
    expect(() => officialHorseBrand("horse_J218' OR 1=1")).toThrow();
  });
  it("never exposes system scores or private fields beside official ratings", () => {
    const rows = projectOfficialRows([{ rating: 40, modelScore: 99, picks: [1,2,3,4], secret: "private" }], HORSE_OFFICIAL_FIELDS.rating);
    expect(rows[0]?.['rating']).toBe(40);
    expect(rows[0]).not.toHaveProperty("modelScore");
    expect(rows[0]).not.toHaveProperty("picks");
    expect(rows[0]).not.toHaveProperty("secret");
  });
});