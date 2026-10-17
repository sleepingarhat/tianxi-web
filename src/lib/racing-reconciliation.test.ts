import { describe, expect, it } from "vitest";
import { predictionTiming, snapshotChanges, validRacingDate } from "./racing-reconciliation";
describe("public racing provenance", () => {
  it("never certifies old generated timestamps as locked receipts", () => {
    expect(predictionTiming("2026-10-14T05:43:59Z", "2026-10-14")).toBe("unverified");
    expect(predictionTiming("2026-10-15T00:00:00Z", "2026-10-14")).toBe("post_race");
    expect(predictionTiming(null, "2026-10-14")).toBe("missing");
  });
  it("detects same-day generation after the official Hong Kong start", () => {
    expect(predictionTiming("2026-10-14T12:00:00Z", "2026-10-14", "19:00")).toBe("post_race");
    expect(predictionTiming("2026-10-14T10:00:00Z", "2026-10-14", "19:00")).toBe("unverified");
  });
  it("does not treat sectional timings as an official start time", () => {
    expect(predictionTiming("2026-10-14T12:00:00Z", "2026-10-14", "(27.36) (51.04) (1:16.33)")).toBe("unverified");
  });
  it("sorts source race 99 before 100 and leaves first delta unknown", () => {
    const base = { entityType: "horse", entityId: "horse_G095", name: "馬", date: "2026-10-14", season: 0, computedAt: "" };
    const rows = snapshotChanges([{ ...base, id: "v12:G095|overall|2026-10-14|HV|100", rating: 1505 }, { ...base, id: "v12:G095|overall|2026-10-14|HV|99", rating: 1500 }]);
    expect(rows[0]?.before).toBeNull(); expect(rows[1]?.delta).toBe(5);
  });
  it("rejects impossible calendar dates and malformed event IDs", () => {
    expect(() => validRacingDate("2026-02-30")).toThrow();
    expect(validRacingDate("2026-10-14")).toBe("2026-10-14");
  });
});