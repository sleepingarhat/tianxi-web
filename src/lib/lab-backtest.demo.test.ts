import { describe, expect, it } from "vitest";
import { isDemoMatrixSource } from "./lab-backtest";

describe("isDemoMatrixSource", () => {
  it("flags demo-fixture / demo-v1 / demo flag", () => {
    expect(isDemoMatrixSource("demo-fixture", "demo-v1")).toBe(true);
    expect(isDemoMatrixSource("r2", "demo-v1")).toBe(true);
    expect(isDemoMatrixSource("demo-fixture", "2026-10-01")).toBe(true);
    expect(isDemoMatrixSource("r2", "2026-10-01", true)).toBe(true);
    expect(isDemoMatrixSource("r2", "demo-abc")).toBe(true);
  });

  it("allows real matrix sources", () => {
    expect(isDemoMatrixSource("r2", "2026-10-01")).toBe(false);
    expect(isDemoMatrixSource("d1-cache", "v3")).toBe(false);
    expect(isDemoMatrixSource(null, null)).toBe(false);
  });
});
