import { describe, expect, it } from "vitest";
import { LAB_TOOLS } from "./lab-tools";
import {
  buildKpiRows,
  findMaxGapDay,
  formatKpiValue,
  seriesPhase,
  type CompareStrategyColumn,
} from "./lab-compare-ui";
import { LIVE_FROM_DATE, listStrategies } from "./lab-backtest";

function fakeStrategy(key: string, label: string): CompareStrategyColumn {
  return {
    key,
    label,
    kind: key === "official" || key === "elo" ? (key as "official" | "elo") : "custom",
    summary: {
      label,
      raceCount: 220,
      avgTop4Hits: 1.5,
      poolHits: {
        FF: { hits: 10, bets: 100, rate: 10 },
        TRIO: { hits: 5, bets: 100, rate: 5 },
      },
      cost: 1000,
      payout: 900,
      net: -100,
      roiPct: -10,
      maxDrawdown: 200,
      maxLosingStreakDays: 3,
      showRoi: true,
    },
    series: [
      {
        date: "2026-10-03",
        races: 1,
        avgTop4Hits: 1,
        cost: 10,
        payout: 0,
        net: -10,
        cum: -10,
        phase: "backtest",
      },
      {
        date: "2026-10-04",
        races: 1,
        avgTop4Hits: 2,
        cost: 10,
        payout: 20,
        net: 10,
        cum: 0,
        phase: "live",
      },
    ],
    liveFrom: LIVE_FROM_DATE,
  };
}

describe("lab-tools compare", () => {
  it("比較器 ready 連 /lab/compare", () => {
    const compare = LAB_TOOLS.find((t) => t.key === "compare");
    expect(compare?.status).toBe("ready");
    expect(compare?.href).toBe("/lab/compare");
  });
});

describe("lab-compare-ui", () => {
  it("LIVE_FROM_DATE 同 phase", () => {
    expect(LIVE_FROM_DATE).toBe("2026-10-04");
    expect(seriesPhase("2026-10-03")).toBe("backtest");
    expect(seriesPhase("2026-10-04")).toBe("live");
  });

  it("KPI rows 有四揀命中同樣本場數", () => {
    const rows = buildKpiRows([fakeStrategy("official", "官方"), fakeStrategy("elo", "Elo")]);
    expect(rows.some((r) => r.id === "avgTop4Hits")).toBe(true);
    expect(rows.some((r) => r.id === "races")).toBe(true);
    const hits = rows.find((r) => r.id === "avgTop4Hits");
    expect(hits?.values['official']).toBe(1.5);
  });

  it("findMaxGapDay 揀最大 gap", () => {
    const best = findMaxGapDay([
      {
        date: "2026-10-03",
        phase: "backtest",
        nets: { a: 0, b: 0 },
        cums: { a: 0, b: 10 },
        maxGap: 10,
        maxGapKeys: ["a", "b"],
      },
      {
        date: "2026-10-04",
        phase: "live",
        nets: { a: 0, b: 0 },
        cums: { a: 0, b: 50 },
        maxGap: 50,
        maxGapKeys: ["a", "b"],
      },
    ]);
    expect(best?.date).toBe("2026-10-04");
  });

  it("formatKpiValue", () => {
    expect(formatKpiValue("money", -12.5)).toContain("12.5");
    expect(formatKpiValue("num", null)).toBe("—");
  });

  it("listStrategies 喺無 window 時唔爆", () => {
    expect(Array.isArray(listStrategies())).toBe(true);
  });
});
