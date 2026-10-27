import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 防止再發生：/lab 係 /lab/h2h 等子頁嘅父路由。
 * 父路由唔渲染 <Outlet /> 嘅話，所有 /lab/* 子頁都只會顯示工具牆。
 */
const routesDir = join(__dirname, "..", "routes");

describe("功能頁路由結構", () => {
  it("/lab 父路由只係佈局，必須渲染 <Outlet />", () => {
    const layout = readFileSync(join(routesDir, "lab.tsx"), "utf8");
    expect(layout).toContain("<Outlet />");
    expect(layout).not.toContain("LAB_TOOLS");
  });

  it("工具牆喺 /lab 嘅 index 子路由", () => {
    const indexPath = join(routesDir, "lab.index.tsx");
    expect(existsSync(indexPath)).toBe(true);
    const index = readFileSync(indexPath, "utf8");
    expect(index).toContain('createFileRoute("/lab/")');
    expect(index).toContain("LAB_TOOLS");
  });

  it("頭對頭子頁同已下架轉址仍登記於 /lab 之下", () => {
    const tree = readFileSync(join(__dirname, "..", "routeTree.gen.ts"), "utf8");
    for (const path of [
      "/lab/h2h",
      "/lab/going",
      "/lab/pace",
      "/lab/pools",
      "/lab/backtest",
      "/lab/compare",
    ]) {
      expect(tree).toContain(`'${path}'`);
    }
    expect(tree).toContain("'/lab/'");
  });

  it("顯示名係功能／Features，舊名研究室／Research lab 唔再出現", () => {
    const files = [
      join(__dirname, "..", "components", "tx", "AppShell.tsx"),
      join(routesDir, "lab.index.tsx"),
      join(routesDir, "lab.h2h.tsx"),
      join(routesDir, "lab.going.tsx"),
      join(__dirname, "lab-h2h.functions.ts"),
      join(__dirname, "lab-tools.ts"),
    ];
    for (const path of files) {
      const src = readFileSync(path, "utf8");
      expect(src, path).not.toContain("研究室");
      expect(src, path).not.toMatch(/research lab/i);
    }
    const shell = readFileSync(join(__dirname, "..", "components", "tx", "AppShell.tsx"), "utf8");
    expect(shell).toContain('to: "/lab"');
    expect(shell).toContain('label: "功能"');
    const index = readFileSync(join(routesDir, "lab.index.tsx"), "utf8");
    expect(index).toContain('en="Features"');
    expect(index).toContain('title="功能"');
    expect(index).toContain("功能 · 天喜 TIANXI");
    expect(index).toContain("功能 · 研究層工具 · 非投注建議");
    expect(index).toContain('createFileRoute("/lab/")');
    const h2h = readFileSync(join(routesDir, "lab.h2h.tsx"), "utf8");
    expect(h2h).toContain("← 功能");
    expect(h2h).toContain("`${H2H_PRODUCT_LABEL} · 功能 · 天喜 TIANXI`");
    expect(h2h).toContain('createFileRoute("/lab/h2h")');
    expect(h2h).not.toContain("對調");
    const going = readFileSync(join(routesDir, "lab.going.tsx"), "utf8");
    expect(going).toContain('redirect({ to: "/lab", replace: true })');
    expect(going).toContain('createFileRoute("/lab/going")');
    expect(going).not.toContain("場地天氣");
    expect(going).not.toContain("FeaturePageGate");
    expect(readFileSync(join(__dirname, "lab-h2h.functions.ts"), "utf8")).toContain(
      "功能服務憑證未就緒，請稍後再試",
    );
    expect(readFileSync(join(__dirname, "lab-h2h.functions.ts"), "utf8")).toContain(
      "練馬師比較暫時未能讀取，請稍後再試",
    );
  });
});
