import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isDemoMatrixSource } from "./lab-backtest";

describe("isDemoMatrixSource", () => {
  it("flags demo-fixture / demo-v1 / demo flag", () => {
    expect(isDemoMatrixSource("demo-fixture", "demo-v1")).toBe(true);
    expect(isDemoMatrixSource("r2", "demo-v1")).toBe(true);
    expect(isDemoMatrixSource("demo-fixture", "2026-10-01")).toBe(true);
    expect(isDemoMatrixSource("r2", "2026-10-01", true)).toBe(true);
    expect(isDemoMatrixSource("r2", "demo-abc")).toBe(true);
  });

  it("allows real matrix sources", () => {
    expect(isDemoMatrixSource("r2", "2026-10-01")).toBe(false);
    expect(isDemoMatrixSource("d1-cache", "v3")).toBe(false);
    expect(isDemoMatrixSource(null, null)).toBe(false);
  });
});

describe("lab backtest surface wiring", () => {
  it("/lab/backtest route gates Pro and mounts lab FeaturesWorkspace", () => {
    const src = readFileSync("src/routes/lab.backtest.tsx", "utf8");
    expect(src).toContain('createFileRoute("/lab/backtest")');
    expect(src).toContain('FeaturePageGate min="pro"');
    expect(src).toContain('<FeaturesWorkspace variant="lab" />');
  });

  it("lab variant uses AppShell NavKey lab + demo Callout", () => {
    const src = readFileSync("src/components/tx/FeaturesWorkspace.tsx", "utf8");
    expect(src).toContain('const shellPage: NavKey = fromLab ? "lab" : "predictor"');
    expect(src).toContain("page={shellPage}");
    expect(src).toContain('role="alert"');
    expect(src).toContain("示範數據 · 非真賽果 · 勿作投注依據");
    expect(src).toContain("ROI／淨／回撤會隱藏或顯示為 —");
  });

  it("BacktestPanel masks ROI on demo + shows demo banner", () => {
    const src = readFileSync("src/components/tx/BacktestPanel.tsx", "utf8");
    expect(src).toContain("isDemoMatrixSource");
    expect(src).toContain("ROI —（示範）");
    expect(src).toContain("淨 —（示範）");
    expect(src).toContain("回撤 —（示範）");
    expect(src).toContain("DEMO_BANNER");
    expect(src).toContain('role="alert"');
  });

  it("FeaturePageGate shows loading shell (no Membership flash)", () => {
    const src = readFileSync("src/components/tx/gates/FeaturePageGate.tsx", "utf8");
    expect(src).toContain("tier.loading");
    expect(src).toContain('aria-label="讀取會籍中"');
    expect(src).toContain("animate-pulse");
  });

  it("AppShell NavKey includes lab bottom nav", () => {
    const src = readFileSync("src/components/tx/AppShell.tsx", "utf8");
    expect(src).toMatch(/export type NavKey =[\s\S]*\| "lab"/);
    expect(src).toContain('key: "lab"');
    expect(src).toContain('to: "/lab"');
  });
});
