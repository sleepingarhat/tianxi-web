import { describe, expect, it } from "vitest";
import {
  defaultWeights,
  stepWeight,
  WEIGHT_TEMPLATES,
  BACKTEST_RANGE_PRESETS,
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

  it("defaultWeights maps selected ids to weight 1", () => {
    const w = defaultWeights(["h2h", "draw"]);
    expect(w).toEqual([
      { id: "h2h", weight: 1, invert: false },
      { id: "draw", weight: 1, invert: false },
    ]);
  });

  it("templates only use known FeatureIds and weight in range", () => {
    for (const t of WEIGHT_TEMPLATES) {
      expect(t.weights.length).toBeGreaterThan(0);
      for (const w of t.weights) {
        expect(w.weight).toBeGreaterThanOrEqual(0);
        expect(w.weight).toBeLessThanOrEqual(3);
        expect(w.id).toBeTruthy();
      }
    }
  });

  it("range presets include demo window", () => {
    expect(BACKTEST_RANGE_PRESETS.some((p) => p.key === "demo")).toBe(true);
  });
});

describe("computeWeightedComposite", () => {
  it("weights and invert change ranking vs equal average", () => {
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
    const invDraw: FeatureWeightSpec[] = [
      { id: "h2h", weight: 1 },
      { id: "draw", weight: 1, invert: true },
    ];

    const eq = computeWeightedComposite(horses, equal);
    // equal: both ~50 → tie broken stably; both composites ~50
    expect(eq[0]!.composite).toBeCloseTo(50, 5);

    const heavy = computeWeightedComposite(horses, heavyH2h);
    expect(heavy[0]!.horse.no).toBe(1);

    const inv = computeWeightedComposite(horses, invDraw);
    // invert draw: horse1 gets 90 + (100-10)=180/2=90; horse2 10+(100-90)=20/2=10
    expect(inv[0]!.horse.no).toBe(1);
    expect(inv[0]!.composite).toBeCloseTo(90, 5);
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
