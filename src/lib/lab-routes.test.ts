import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 防止再發生：/lab 係 /lab/h2h 等子頁嘅父路由。
 * 父路由唔渲染 <Outlet /> 嘅話，所有 /lab/* 子頁都只會顯示工具牆。
 */
const routesDir = join(__dirname, "..", "routes");

describe("研究室路由結構", () => {
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

  it("頭對頭／場地天氣子頁同已下架轉址仍登記於 /lab 之下", () => {
    const tree = readFileSync(join(__dirname, "..", "routeTree.gen.ts"), "utf8");
    for (const path of ["/lab/h2h", "/lab/going", "/lab/pace", "/lab/pools", "/lab/backtest", "/lab/compare"]) {
      expect(tree).toContain(`'${path}'`);
    }
    expect(tree).toContain("'/lab/'");
  });
});
