import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { LAB_TOOLS } from "./lab-tools";

describe("lab backtest/compare decommission", () => {
  it("LAB_TOOLS 不再列出回測／比較器；其餘四工具保留", () => {
    expect(LAB_TOOLS.some((t) => t.key === "backtest" || t.key === "compare")).toBe(false);
    expect(LAB_TOOLS.map((t) => t.key).sort()).toEqual(["going", "h2h", "pace", "pool-opt"].sort());
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
    expect(src).not.toContain("variant: \"lab\"");
    expect(src).not.toContain("onSaveStrategy");
    expect(src).not.toContain("自訂回測");
    expect(existsSync("src/components/tx/BacktestPanel.tsx")).toBe(false);
    expect(existsSync("src/lib/lab-backtest.functions.ts")).toBe(false);
    expect(existsSync("src/lib/lab-compare-ui.ts")).toBe(false);
    expect(existsSync("src/lib/lab-compare-ui.test.ts")).toBe(false);
  });
});
