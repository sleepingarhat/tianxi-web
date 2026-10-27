import { describe, expect, it } from "vitest";

import {
  mapCloudStrategyRow,
  planLocalStrategiesMigration,
  sanitizeFeatureWeights,
  type SavedStrategy,
} from "./lab-backtest";

describe("user-strategies mapping", () => {
  it("mapCloudStrategyRow 映射欄位", () => {
    const s = mapCloudStrategyRow({
      id: "11111111-1111-1111-1111-111111111111",
      name: "均衡",
      note: "hello",
      current_version: 3,
      pools: ["FF", "TRIO"],
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-02T00:00:00Z",
      last_backtest_hash: "abc",
      weights: [{ id: "careerWin", weight: 2 }],
    });
    expect(s.id).toContain("1111");
    expect(s.name).toBe("均衡");
    expect(s.version).toBe(3);
    expect(s.pools).toEqual(["FF", "TRIO"]);
    expect(s.weights[0]?.id).toBe("careerWin");
    expect(s.lastBacktestHash).toBe("abc");
    expect(s.createdAt).toBe("2026-10-01T00:00:00Z");
  });

  it("mapCloudStrategyRow 無 hash 時唔帶 lastBacktestHash（exactOptional）", () => {
    const s = mapCloudStrategyRow({
      id: "33333333-3333-3333-3333-333333333333",
      name: "nohash",
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
      last_backtest_hash: null,
      weights: [{ id: "form", weight: 1 }],
    });
    expect("lastBacktestHash" in s).toBe(false);
  });

  it("mapCloudStrategyRow 過濾非法 pool", () => {
    const s = mapCloudStrategyRow({
      id: "22222222-2222-2222-2222-222222222222",
      name: "x",
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
      pools: ["FF", "NOPE", "QUARTET"] as unknown as string[],
    });
    expect(s.pools).toEqual(["FF", "QUARTET"]);
  });

  it("sanitizeFeatureWeights 過濾非 FeatureId（例如模板 key elo）", () => {
    const w = sanitizeFeatureWeights([
      { id: "elo", weight: 2 },
      { id: "careerWin", weight: 2, invert: true },
      { id: "form", weight: 1, invert: false },
      { id: "nope", weight: 9 },
    ]);
    expect(w).toEqual([
      { id: "careerWin", weight: 2, invert: true },
      { id: "form", weight: 1 },
    ]);
  });

  it("planLocalStrategiesMigration 略過雲端已有同名", () => {
    const local: SavedStrategy[] = [
      {
        id: "local_a",
        name: "A",
        note: "",
        version: 1,
        weights: [{ id: "form", weight: 1 }],
        pools: ["FF"],
        createdAt: "t",
        updatedAt: "t",
      },
      {
        id: "local_b",
        name: "B",
        note: "",
        version: 1,
        weights: [{ id: "draw", weight: 1 }],
        pools: ["FF"],
        createdAt: "t",
        updatedAt: "t",
      },
    ];
    const plan = planLocalStrategiesMigration(local, new Set(["A"]));
    expect(plan.toUpsert.map((s) => s.name)).toEqual(["B"]);
    expect(plan.local).toHaveLength(2);
  });

  it("planLocalStrategiesMigration 空名唔遷移", () => {
    const local: SavedStrategy[] = [
      {
        id: "local_c",
        name: "   ",
        note: "",
        version: 1,
        weights: [],
        pools: ["FF"],
        createdAt: "t",
        updatedAt: "t",
      },
    ];
    expect(planLocalStrategiesMigration(local).toUpsert).toHaveLength(0);
  });
});

describe("user-strategies UI wiring（features 帳號卡）", () => {
  it("FeaturesWorkspace 已移除回測／策略雲端卡（表可留空）", async () => {
    const { readFileSync, existsSync } = await import("node:fs");
    const src = readFileSync("src/components/tx/FeaturesWorkspace.tsx", "utf8");
    expect(src).not.toContain("listUserStrategies");
    expect(src).not.toContain("BacktestPanel");
    expect(src).not.toContain("我的策略（帳號）");
    expect(existsSync("src/components/tx/BacktestPanel.tsx")).toBe(false);
  });
});
