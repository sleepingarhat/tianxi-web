import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

import { validateEntityId } from "./lab-entity-id";
import { LAB_TOOLS } from "./lab-tools";
import {
  H2H_PRODUCT_LABEL,
  aheadLabel,
  buildEloOption,
  entityLabel,
  filterEntities,
  parseOptionalDistance,
  selectableEntities,
  venueLabel,
} from "./lab-h2h-ui";

describe("lab-tools", () => {
  it("頭對頭／場地入口為 ready；走位節奏、彩池優化器、自訂回測與比較器已下架", () => {
    const h2h = LAB_TOOLS.find((t) => t.key === "h2h");
    expect(h2h?.status).toBe("ready");
    expect(h2h?.href).toBe("/lab/h2h");
    expect(h2h?.title).toBe(H2H_PRODUCT_LABEL);
    const going = LAB_TOOLS.find((t) => t.key === "going");
    expect(going?.status).toBe("ready");
    expect(going?.href).toBe("/lab/going");
    expect(LAB_TOOLS).toHaveLength(2);
    expect(LAB_TOOLS.find((t) => t.key === "pace")).toBeUndefined();
    expect(LAB_TOOLS.find((t) => t.key === "pool-opt")).toBeUndefined();
    expect(LAB_TOOLS.find((t) => t.key === "backtest")).toBeUndefined();
    expect(LAB_TOOLS.find((t) => t.key === "compare")).toBeUndefined();
    const opened = new Set(["h2h", "going"]);
    expect(LAB_TOOLS.filter((t) => !opened.has(t.key)).every((t) => t.status !== "ready")).toBe(true);
  });
});

describe("validateEntityId", () => {
  it("接受中文騎師 id，舊 ASCII 正則會拒絕", () => {
    expect(validateEntityId("jockey", "jockey_潘頓")).toBe(true);
    expect(validateEntityId("jockey", "jockey_莫雷拉")).toBe(true);
    expect(validateEntityId("jockey", "jockey_郭能")).toBe(true);
    expect(validateEntityId("jockey", "jockey_PZ")).toBe(true);
    expect(validateEntityId("jockey", "jockey_---")).toBe(true);
    expect(validateEntityId("jockey", "潘頓")).toBe(false);
    expect(validateEntityId("jockey", "jockey_潘 頓")).toBe(false);
    expect(validateEntityId("jockey", "jockey_潘.頓")).toBe(false);
    expect(validateEntityId("jockey", "jockey_")).toBe(false);
    expect(validateEntityId("horse", "horse_E061")).toBe(true);
    expect(validateEntityId("horse", "horse_金鎗六十")).toBe(true);
    expect(validateEntityId("horse", "jockey_潘頓")).toBe(false);
    expect(/^jockey_[A-Za-z0-9_-]+$/.test("jockey_潘頓")).toBe(false);
  });

  it("清單只留通過驗證嘅對象，搜尋可篩中文名", () => {
    const rows = selectableEntities("jockey", [
      { id: "jockey_潘頓", nameCh: "潘頓", nameEn: null, code: null, status: "active" },
      { id: "not-an-id", nameCh: "壞", nameEn: null, code: null, status: null },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["jockey_潘頓"]);
    expect(filterEntities(rows, "潘").map((r) => r.nameCh)).toEqual(["潘頓"]);
    expect(filterEntities(rows, "zzz")).toEqual([]);
  });
});

describe("h2h picker UX", () => {
  it("頁面用清單揀選、產品名已改、冇對調", () => {
    const src = readFileSync("src/routes/lab.h2h.tsx", "utf8");
    expect(src).toContain("OptionListPicker");
    expect(src).toContain(H2H_PRODUCT_LABEL);
    expect(src).not.toContain("對調");
    expect(src).not.toContain("searchLabEntity");
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
