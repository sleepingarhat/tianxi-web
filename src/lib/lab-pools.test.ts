import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { LAB_TOOLS } from "./lab-tools";
import {
  POOLS_DISCLAIMER_EXTRA,
  POOLS_PAGE_DESC,
  POOLS_RESEARCH_BANNER,
  assertNoBetUrls,
  buildOptimizeParams,
  parseRaceIdsInput,
} from "./lab-pools-ui";

describe("lab-tools pool-opt", () => {
  it("pool-opt ready → /lab/pools", () => {
    const pool = LAB_TOOLS.find((t) => t.key === "pool-opt");
    expect(pool?.status).toBe("ready");
    expect(pool?.href).toBe("/lab/pools");
  });
});

describe("lab-pools-ui", () => {
  it("研究橫額／disclaimer 文案", () => {
    expect(POOLS_RESEARCH_BANNER).toBe("研究用・唔係官方建議・唔入公開戰績");
    expect(POOLS_DISCLAIMER_EXTRA).toContain("無一鍵投注");
    expect(POOLS_PAGE_DESC).toContain("無落注連結");
  });

  it("optimize 參數 shape", () => {
    expect(parseRaceIdsInput("race_a, race_b\nrace_c")).toEqual([
      "race_a",
      "race_b",
      "race_c",
    ]);
    const ok = buildOptimizeParams({
      pool: "FF",
      raceIdsText: "race_2026-10-25_ST_1",
      budget: "100",
      method: "top_k",
    });
    expect(ok).toEqual({
      pool: "FF",
      raceIds: ["race_2026-10-25_ST_1"],
      budget: 100,
      method: "top_k",
    });
    expect(
      buildOptimizeParams({ pool: "FF", raceIdsText: "", budget: 100 }),
    ).toBeNull();
    expect(
      buildOptimizeParams({
        pool: "FF",
        raceIdsText: "race_x",
        budget: "bad",
      }),
    ).toBeNull();
  });

  it("無 bet URL", () => {
    expect(assertNoBetUrls({ betUrl: null, placeBetUrl: null })).toBe(true);
    expect(assertNoBetUrls({ betUrl: "https://bet.example", placeBetUrl: null })).toBe(
      false,
    );
  });
});

describe("lab.pools route surface", () => {
  it("route 含研究橫額、無投注連結關鍵字，並用 UI 常數", () => {
    const src = readFileSync("src/routes/lab.pools.tsx", "utf8");
    expect(src).toContain("POOLS_RESEARCH_BANNER");
    expect(src).toContain("POOLS_DISCLAIMER_EXTRA");
    expect(src).toContain('createFileRoute("/lab/pools")');
    expect(src).toContain('FeaturePageGate min="pro"');
    expect(src.toLowerCase()).not.toMatch(/href=["'][^"']*bet/);
    expect(src).not.toMatch(/placeBet|one-click|一鍵投注連結/i);
  });
});
