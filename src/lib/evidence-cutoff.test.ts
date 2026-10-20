import { describe, expect, it } from "vitest";
import { isLegacyEvidenceDate } from "./evidence-cutoff";

describe("evidence cutoff", () => {
  it("2026-10-20 及之前係舊紀錄", () => expect(isLegacyEvidenceDate("2026-10-20")).toBe(true));
  it("2026-10-21 起用新規則", () => expect(isLegacyEvidenceDate("2026-10-21")).toBe(false));
});
