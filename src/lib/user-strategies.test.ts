import { describe, expect, it } from "vitest";

import {
  mapCloudStrategyRow,
  planLocalStrategiesMigration,
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
      weights: [{ id: "elo", weight: 2 }],
    });
    expect(s.id).toContain("1111");
    expect(s.name).toBe("均衡");
    expect(s.version).toBe(3);
    expect(s.pools).toEqual(["FF", "TRIO"]);
    expect(s.weights[0]?.id).toBe("elo");
    expect(s.lastBacktestHash).toBe("abc");
    expect(s.createdAt).toBe("2026-10-01T00:00:00Z");
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
