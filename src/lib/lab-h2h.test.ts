import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

import { validateEntityId } from "./lab-entity-id";
import { LAB_TOOLS } from "./lab-tools";
import { shouldShowOptionList } from "./option-list";
import {
  H2H_DISTANCE_OPTIONS,
  H2H_GOING_OPTIONS,
  H2H_PRODUCT_LABEL,
  aheadLabel,
  buildEloOption,
  eloEmptyLabel,
  entityLabel,
  fillPickFromEntities,
  filterEntities,
  parseOptionalDistance,
  resolveTrainerCatalog,
  selectableEntities,
  venueLabel,
  withCurrentChoice,
} from "./lab-h2h-ui";

describe("lab-tools", () => {
  it("只剩馬騎練比較一張 ready 卡；場地、走位、彩池、回測、比較器已下架", () => {
    const h2h = LAB_TOOLS.find((t) => t.key === "h2h");
    expect(h2h?.status).toBe("ready");
    expect(h2h?.href).toBe("/lab/h2h");
    expect(h2h?.title).toBe(H2H_PRODUCT_LABEL);
    expect(H2H_PRODUCT_LABEL).toBe("馬騎練數據獨立比較");
    expect(LAB_TOOLS).toHaveLength(1);
    expect(LAB_TOOLS.find((t) => t.key === "going")).toBeUndefined();
    expect(LAB_TOOLS.find((t) => t.key === "pace")).toBeUndefined();
    expect(LAB_TOOLS.find((t) => t.key === "pool-opt")).toBeUndefined();
    expect(LAB_TOOLS.find((t) => t.key === "backtest")).toBeUndefined();
    expect(LAB_TOOLS.find((t) => t.key === "compare")).toBeUndefined();
    expect(LAB_TOOLS.every((t) => t.status === "ready" && t.key === "h2h")).toBe(true);
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
    expect(validateEntityId("trainer", "trainer_方嘉柏")).toBe(true);
    expect(validateEntityId("trainer", "trainer_蔡約翰")).toBe(true);
    expect(validateEntityId("trainer", "trainer_CJA")).toBe(true);
    expect(validateEntityId("trainer", "方嘉柏")).toBe(false);
    expect(validateEntityId("trainer", "trainer_方 嘉柏")).toBe(false);
    expect(validateEntityId("trainer", "trainer_")).toBe(false);
    expect(validateEntityId("trainer", "jockey_潘頓")).toBe(false);
    expect(validateEntityId("jockey", "trainer_方嘉柏")).toBe(false);
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
    const trainers = selectableEntities("trainer", [
      { id: "trainer_蔡約翰", nameCh: "蔡約翰", nameEn: null, code: null, status: "active" },
      { id: "蔡約翰", nameCh: "壞", nameEn: null, code: null, status: null },
    ]);
    expect(trainers.map((r) => r.id)).toEqual(["trainer_蔡約翰"]);
  });

  it("練馬師搜尋優先用 lab search，否則退回公開名單", () => {
    const pub = [
      { id: "trainer_蔡約翰", nameCh: "蔡約翰", nameEn: null, code: null, status: "active" },
      { id: "trainer_方嘉柏", nameCh: "方嘉柏", nameEn: null, code: null, status: "active" },
    ];
    const searched = resolveTrainerCatalog({
      query: "蔡",
      searchItems: [
        { id: "trainer_蔡約翰", nameCh: "蔡約翰", nameEn: null, code: null, status: "active" },
      ],
      publicItems: pub,
    });
    expect(searched.fromSearch).toBe(true);
    expect(searched.items.map((r) => r.id)).toEqual(["trainer_蔡約翰"]);
    const fallback = resolveTrainerCatalog({
      query: "方",
      searchItems: [],
      publicItems: pub,
    });
    expect(fallback.fromSearch).toBe(false);
    expect(fallback.items.map((r) => r.id)).toEqual(["trainer_蔡約翰", "trainer_方嘉柏"]);
    expect(filterEntities(fallback.items, "方").map((r) => r.nameCh)).toEqual(["方嘉柏"]);
    expect(
      resolveTrainerCatalog({ query: "蔡", searchItems: null, publicItems: pub }).fromSearch,
    ).toBe(false);
  });
});

describe("h2h picker UX", () => {
  it("頁面用清單揀選、途程地況係選項、可揀練馬師、產品名已改、冇對調", () => {
    const src = readFileSync("src/routes/lab.h2h.tsx", "utf8");
    expect(src).toContain("OptionListPicker");
    expect(src).toContain("H2H_PRODUCT_LABEL");
    expect(src).toContain("比練馬師");
    expect(src).toContain("H2H_DISTANCE_OPTIONS");
    expect(src).toContain("H2H_GOING_OPTIONS");
    expect(src).toContain("清除已揀");
    expect(src).toContain("searchLabEntity");
    expect(src).toContain("grid-cols-1");
    expect(src).toContain("eloEmptyLabel");
    expect(src).not.toContain("對調");
    expect(src).not.toContain('placeholder="例如 1200"');
    expect(src).not.toContain('placeholder="例如 好"');
    expect(src).not.toContain("場地天氣");
  });

  it("OptionListPicker 揀完清空搜尋並收起清單", () => {
    const src = readFileSync("src/components/tx/OptionListPicker.tsx", "utf8");
    expect(src).toContain("shouldShowOptionList({ selectedId, query, focused })");
    expect(src).toContain('onQueryChange("")');
    expect(src).toContain("blur()");
    expect(src).toContain("{open ? (");
    expect(shouldShowOptionList({ selectedId: "horse_E175", query: "", focused: false })).toBe(
      false,
    );
    expect(shouldShowOptionList({ selectedId: "horse_E175", query: "天火", focused: true })).toBe(
      true,
    );
    expect(shouldShowOptionList({ selectedId: "", query: "", focused: false })).toBe(true);
    expect(shouldShowOptionList({ selectedId: "trainer_蔡約翰", query: "", focused: true })).toBe(
      true,
    );
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
    expect(H2H_DISTANCE_OPTIONS.map((o) => o.id)).toEqual([
      "",
      "1000",
      "1200",
      "1400",
      "1600",
      "1650",
      "1800",
      "2000",
      "2200",
      "2400",
    ]);
    expect(H2H_DISTANCE_OPTIONS[0]?.label).toBe("全部");
    expect(H2H_GOING_OPTIONS[0]).toEqual({ id: "", label: "全部" });
    for (const bucket of ["好地", "好地至快地", "快地", "黏地", "軟地", "濕快地", "封地"]) {
      expect(H2H_GOING_OPTIONS.some((o) => o.id === bucket)).toBe(true);
    }
    const goingIds = H2H_GOING_OPTIONS.map((option) => option.id as string);
    expect(goingIds).not.toContain("濕軟");
    expect(goingIds).not.toContain("怪地");
    expect(
      withCurrentChoice(H2H_GOING_OPTIONS, "好地至快地").some((o) => o.id === "好地至快地"),
    ).toBe(true);
    expect(withCurrentChoice(H2H_DISTANCE_OPTIONS, "1650")).toHaveLength(
      H2H_DISTANCE_OPTIONS.length,
    );
    expect(eloEmptyLabel("trainer")).toContain("練馬師");
    expect(eloEmptyLabel("trainer")).toContain("Elo");
    expect(eloEmptyLabel("horse")).toBe("暫時未有 Elo 快照");
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

  it("練馬師冇 Elo 都唔擲錯", () => {
    const opt = buildEloOption({
      entities: {
        a: { id: "trainer_蔡約翰", nameCh: "蔡約翰", nameEn: null, code: null, status: "active" },
        b: { id: "trainer_方嘉柏", nameCh: "方嘉柏", nameEn: null, code: null, status: "active" },
      },
      elo: null,
    });
    expect((opt.series as any[])[0].data).toEqual([]);
    expect((opt.series as any[])[1].data).toEqual([]);
    expect((opt.series as any[])[0].markPoint).toBeUndefined();
  });
});

describe("fillPickFromEntities（閃爍回歸）", () => {
  const f = { id: "trainer_方嘉柏", nameCh: "方嘉柏", nameEn: null, code: "PF", status: "active" };
  const l = { id: "trainer_呂健威", nameCh: "呂健威", nameEn: null, code: "KL", status: "active" };

  it("回應 a/b 次序對調都按 id 補名，唔會跟住對調", () => {
    const pickA = { id: "trainer_方嘉柏", nameCh: null, nameEn: null, code: null, status: null };
    const swapped = { a: l, b: f };
    const filled = fillPickFromEntities(pickA, swapped);
    expect(filled?.id).toBe("trainer_方嘉柏");
    expect(filled?.nameCh).toBe("方嘉柏");
  });

  it("已有名嘅揀選原樣返回同一引用，唔再觸發狀態更新", () => {
    const pick = { id: "trainer_方嘉柏", nameCh: "方嘉柏", nameEn: null, code: null, status: null };
    expect(fillPickFromEntities(pick, { a: l, b: f })).toBe(pick);
    expect(fillPickFromEntities(pick, { a: f, b: l })).toBe(pick);
  });

  it("空揀選、缺 entities 或 id 配對唔到都原樣返回", () => {
    expect(fillPickFromEntities(null, { a: f, b: l })).toBeNull();
    const pick = { id: "trainer_蔡約翰", nameCh: null, nameEn: null, code: null, status: null };
    expect(fillPickFromEntities(pick, null)).toBe(pick);
    expect(fillPickFromEntities(pick, { a: f, b: l })).toBe(pick);
  });
});
