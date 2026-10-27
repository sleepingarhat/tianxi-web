import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { LAB_TOOLS } from "./lab-tools";

describe("lab backtest/compare decommission", () => {
  it("LAB_TOOLS 不再列出回測／比較器", () => {
    expect(LAB_TOOLS.some((t) => t.key === "backtest" || t.key === "compare")).toBe(false);
  });

  it("/lab/backtest 與 /lab/compare 只做 replace 轉去 /lab", () => {
    for (const path of ["src/routes/lab.backtest.tsx", "src/routes/lab.compare.tsx"]) {
      const src = readFileSync(path, "utf8");
      expect(src).toContain('redirect({ to: "/lab", replace: true })');
      expect(src).not.toContain("FeaturesWorkspace");
      expect(src).not.toContain("BacktestPanel");
      expect(src).not.toContain("runLabCompare");
    }
  });

  it("features 工作區無回測卡；BacktestPanel／lab-backtest.functions 已刪", () => {
    const src = readFileSync("src/components/tx/FeaturesWorkspace.tsx", "utf8");
    expect(src).not.toContain("BacktestPanel");
    expect(src).not.toContain('variant="lab"');
    expect(src).not.toContain('variant: "lab"');
    expect(src).not.toContain("onSaveStrategy");
    expect(src).not.toContain("自訂回測");
    expect(existsSync("src/components/tx/BacktestPanel.tsx")).toBe(false);
    expect(existsSync("src/lib/lab-backtest.functions.ts")).toBe(false);
    expect(existsSync("src/lib/lab-compare-ui.ts")).toBe(false);
    expect(existsSync("src/lib/lab-compare-ui.test.ts")).toBe(false);
  });
});

describe("lab pace/pools decommission", () => {
  it("LAB_TOOLS 唔再列出走位節奏同彩池", () => {
    expect(LAB_TOOLS.find((t) => t.key === "pace")).toBeUndefined();
    expect(LAB_TOOLS.find((t) => t.key === "pool-opt")).toBeUndefined();
  });

  it("/lab/pace 與 /lab/pools 只做 replace 轉去 /lab", () => {
    for (const path of ["src/routes/lab.pace.tsx", "src/routes/lab.pools.tsx"]) {
      const src = readFileSync(path, "utf8");
      expect(src).toContain('redirect({ to: "/lab", replace: true })');
      expect(src).not.toContain("FeaturePageGate");
      expect(src).not.toContain("getLabPace");
      expect(src).not.toContain("optimizeLabPools");
      expect(src).not.toContain("PaceBumpChart");
    }
  });

  it("走位節奏／彩池優化器產品 UI 已刪", () => {
    for (const path of [
      "src/components/tx/RacePacePanel.tsx",
      "src/components/tx/PaceBumpChart.tsx",
      "src/lib/lab-pace.functions.ts",
      "src/lib/lab-pace-ui.ts",
      "src/lib/lab-pace-ui.test.ts",
      "src/lib/lab-pools.functions.ts",
      "src/lib/lab-pools.functions.test.ts",
      "src/lib/lab-pools-ui.ts",
      "src/lib/lab-pools.test.ts",
    ]) {
      expect(existsSync(path)).toBe(false);
    }
    const race = readFileSync("src/routes/race.tsx", "utf8");
    expect(race).not.toContain("RacePacePanel");
    expect(race).not.toContain("走位／節奏");
    expect(race).not.toContain("/lab/pace");
    const index = readFileSync("src/routes/lab.index.tsx", "utf8");
    expect(index).not.toContain("走位節奏");
    expect(index).not.toContain("彩池優化");
    expect(index).not.toContain("/lab/pace");
    expect(index).not.toContain("/lab/pools");
  });
});

describe("lab going decommission", () => {
  it("LAB_TOOLS 只保留馬騎練比較，唔再有場地卡", () => {
    expect(LAB_TOOLS.map((t) => t.key)).toEqual(["h2h"]);
    expect(LAB_TOOLS[0]?.status).toBe("ready");
    expect(LAB_TOOLS[0]?.title).toBe("馬騎練數據獨立比較");
    expect(LAB_TOOLS.find((t) => t.key === "going")).toBeUndefined();
  });

  it("/lab/going 只做 replace 轉去 /lab", () => {
    const src = readFileSync("src/routes/lab.going.tsx", "utf8");
    expect(src).toContain('redirect({ to: "/lab", replace: true })');
    expect(src).toContain('createFileRoute("/lab/going")');
    expect(src).not.toContain("FeaturePageGate");
    expect(src).not.toContain("場地天氣");
    expect(src).not.toContain("getLabGoing");
    expect(src).not.toContain("OptionListPicker");
  });

  it("場地產品 UI 已刪，導航同文案唔再提場地天氣", () => {
    for (const path of [
      "src/components/tx/GoingHeatmap.tsx",
      "src/lib/lab-going.functions.ts",
      "src/lib/lab-going-ui.ts",
      "src/lib/lab-going-ui.test.ts",
    ]) {
      expect(existsSync(path)).toBe(false);
    }
    const index = readFileSync("src/routes/lab.index.tsx", "utf8");
    expect(index).not.toContain("場地天氣");
    expect(index).not.toContain("/lab/going");
    expect(index).toContain("H2H_PRODUCT_LABEL");
    const weather = readFileSync("src/components/tx/WeatherPanel.tsx", "utf8");
    expect(weather).not.toContain("場地天氣");
    expect(weather).not.toContain("/lab/going");
    const tools = readFileSync("src/lib/lab-tools.ts", "utf8");
    expect(tools).not.toContain("場地天氣");
    const h2h = readFileSync("src/routes/lab.h2h.tsx", "utf8");
    expect(h2h).not.toContain("場地天氣");
  });
});
