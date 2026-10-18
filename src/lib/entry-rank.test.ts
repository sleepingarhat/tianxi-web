import { describe, expect, it } from "vitest";

import { entryRankMap } from "./entry-rank";

describe("入場（入 Q）排名", () => {
  it("按 pTop4 降序排名次，同機率並列", () => {
    const m = entryRankMap([
      { horseNumber: 4, pTop4: 0.497 },
      { horseNumber: 2, pTop4: 0.459 },
      { horseNumber: 6, pTop4: 0.459 },
      { horseNumber: 1, pTop4: 0.363 },
    ]);
    expect(m.get("4")).toBe(1);
    expect(m.get("2")).toBe(2);
    expect(m.get("6")).toBe(2);
    expect(m.get("1")).toBe(4);
  });

  it("缺 pTop4 嘅馬唔計名次，亦唔佔名次", () => {
    const m = entryRankMap([
      { horseNumber: 7, pTop4: null },
      { horseNumber: 8 },
      { horseNumber: 9, pTop4: 0.2 },
      { horseNumber: 10, pTop4: Number.NaN },
    ]);
    expect(m.get("9")).toBe(1);
    expect(m.has("7")).toBe(false);
    expect(m.has("8")).toBe(false);
    expect(m.has("10")).toBe(false);
  });

  it("空輸入回空表", () => {
    expect(entryRankMap([]).size).toBe(0);
  });
});
