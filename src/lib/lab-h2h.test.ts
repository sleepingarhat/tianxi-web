import { describe, expect, it } from "vitest";

import { LAB_TOOLS } from "./lab-tools";
import {
  aheadLabel,
  buildEloOption,
  entityLabel,
  parseOptionalDistance,
  venueLabel,
} from "./lab-h2h-ui";

describe("lab-tools", () => {
  it("頭對頭／比較器／彩池／回測入口為 ready；其餘未假做可用", () => {
    const h2h = LAB_TOOLS.find((t) => t.key === "h2h");
    expect(h2h?.status).toBe("ready");
    expect(h2h?.href).toBe("/lab/h2h");
    const compare = LAB_TOOLS.find((t) => t.key === "compare");
    expect(compare?.status).toBe("ready");
    expect(compare?.href).toBe("/lab/compare");
    const pool = LAB_TOOLS.find((t) => t.key === "pool-opt");
    expect(pool?.status).toBe("ready");
    expect(pool?.href).toBe("/lab/pools");
    const bt = LAB_TOOLS.find((t) => t.key === "backtest");
    expect(bt?.status).toBe("ready");
    expect(bt?.href).toBe("/features");
    const opened = new Set(["h2h", "pace", "going", "pool-opt", "backtest", "compare"]);
    expect(LAB_TOOLS.filter((t) => !opened.has(t.key)).every((t) => t.status !== "ready")).toBe(true);
  });
});

describe("lab-h2h-ui", () => {
  it("顯示名稱同場地標籤", () => {
    expect(entityLabel({ nameCh: "金鎗六十", nameEn: null, code: "C352", id: "horse_C352" })).toBe(
      "金鎗六十",
    );
    expect(venueLabel("ST")).toBe("沙田");
    expect(venueLabel("HV")).toBe("跑馬地");
    expect(aheadLabel("a", "甲", "乙")).toBe("甲 較前");
    expect(parseOptionalDistance("1200")).toBe(1200);
    expect(parseOptionalDistance("")).toBeUndefined();
  });

  it("Elo option 有雙線同同場標註", () => {
    const opt = buildEloOption({
      entities: {
        a: { id: "horse_A", nameCh: "甲", nameEn: null, code: null, status: "active" },
        b: { id: "horse_B", nameCh: "乙", nameEn: null, code: null, status: "active" },
      },
      elo: {
        a: [
          { date: "2026-01-01", rating: 1500 },
          { date: "2026-02-01", rating: 1510 },
        ],
        b: [
          { date: "2026-01-01", rating: 1480 },
          { date: "2026-02-01", rating: 1490 },
        ],
        meetings: [{ date: "2026-01-01", raceId: "race_1", venue: "ST", raceNumber: 1 }],
      },
    });
    expect((opt.series as any[]).length).toBe(2);
    expect((opt.series as any[])[0].markPoint?.data?.length).toBe(1);
  });
});
