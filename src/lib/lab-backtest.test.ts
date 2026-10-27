import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  defaultWeights,
  stepWeight,
  BACKTEST_RANGE_PRESETS,
  sanitizeFeatureWeights,
} from "./lab-backtest";
import { computeWeightedComposite, type FeatureWeightSpec } from "./feature-ranking";
import type { FeatureId, Horse } from "./race-data";

function fakeHorse(no: number, scores: Partial<Record<FeatureId, number>>): Horse {
  const base = {
    win: 0,
    place: 0,
    metric: "",
    score: 50,
  };
  const stats = {} as Horse["stats"];
  for (const id of Object.keys(scores) as FeatureId[]) {
    stats[id] = { ...base, score: scores[id]! };
  }
  // fill missing with 0 so access doesn't throw
  return {
    no,
    name: `H${no}`,
    odds: 10,
    stats: new Proxy(stats, {
      get(t, p: string) {
        return t[p as FeatureId] ?? { ...base, score: 0 };
      },
    }),
  } as Horse;
}

describe("lab-backtest helpers", () => {
  it("stepWeight clamps 0–3 at 0.5 steps", () => {
    expect(stepWeight(1, 0.5)).toBe(1.5);
    expect(stepWeight(2.8, 0.5)).toBe(3);
    expect(stepWeight(0.2, -0.5)).toBe(0);
    expect(stepWeight(1.25, 0)).toBe(1.5); // rounds to nearest 0.5 then +0 → actually Math.round(1.25*2)/2 = 1.5
  });

  it("defaultWeights maps selected ids to weight 1 without invert", () => {
    const w = defaultWeights(["h2h", "draw"]);
    expect(w).toEqual([
      { id: "h2h", weight: 1 },
      { id: "draw", weight: 1 },
    ]);
  });

  it("sanitizeFeatureWeights 丟棄舊 invert，權重愈高愈好", () => {
    expect(
      sanitizeFeatureWeights([
        { id: "draw", weight: 2, invert: true },
        { id: "form", weight: 1, invert: false },
      ]),
    ).toEqual([
      { id: "draw", weight: 2 },
      { id: "form", weight: 1 },
    ]);
  });

  it("權重介面冇模板同反向，可排序文案唔再等同未採用", () => {
    const panel = readFileSync("src/components/tx/FeatureWeightPanel.tsx", "utf8");
    const picker = readFileSync("src/components/tx/FeaturePickerSheet.tsx", "utf8");
    const backtest = readFileSync("src/lib/lab-backtest.ts", "utf8");
    expect(panel).not.toContain("WEIGHT_TEMPLATES");
    expect(panel).not.toContain("反向");
    expect(panel).toContain("愈高愈好");
    expect(backtest).not.toContain("WEIGHT_TEMPLATES");
    expect(picker).toContain("唔等於");
    expect(picker).toContain("可即場排序，唔等於引擎未採用");
  });

  it("range presets include demo window", () => {
    expect(BACKTEST_RANGE_PRESETS.some((p) => p.key === "demo")).toBe(true);
  });
});

describe("computeWeightedComposite", () => {
  it("weights change ranking vs equal average; legacy invert is ignored", () => {
    const horses = [
      fakeHorse(1, { h2h: 90, draw: 10 }),
      fakeHorse(2, { h2h: 10, draw: 90 }),
    ];
    const equal: FeatureWeightSpec[] = [
      { id: "h2h", weight: 1 },
      { id: "draw", weight: 1 },
    ];
    const heavyH2h: FeatureWeightSpec[] = [
      { id: "h2h", weight: 3 },
      { id: "draw", weight: 0.5 },
    ];
    const legacyInvert = [
      { id: "h2h" as const, weight: 1 },
      { id: "draw" as const, weight: 1, invert: true },
    ] as FeatureWeightSpec[];

    const eq = computeWeightedComposite(horses, equal);
    expect(eq[0]!.composite).toBeCloseTo(50, 5);
    expect(eq[1]!.composite).toBeCloseTo(50, 5);

    const heavy = computeWeightedComposite(horses, heavyH2h);
    expect(heavy[0]!.horse.no).toBe(1);

    const kept = computeWeightedComposite(horses, legacyInvert);
    expect(kept[0]!.composite).toBeCloseTo(50, 5);
    expect(kept[1]!.composite).toBeCloseTo(50, 5);
  });

  it("ignores zero-weight features", () => {
    const horses = [fakeHorse(1, { h2h: 80, draw: 20 }), fakeHorse(2, { h2h: 20, draw: 80 })];
    const rows = computeWeightedComposite(horses, [
      { id: "h2h", weight: 2 },
      { id: "draw", weight: 0 },
    ]);
    expect(rows[0]!.horse.no).toBe(1);
    expect(rows[0]!.composite).toBeCloseTo(80, 5);
  });
});
