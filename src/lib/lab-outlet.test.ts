import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { LAB_TOOLS } from "./lab-tools";

describe("lab route Outlet / index wiring", () => {
  it("LAB_TOOLS ready hrefs still point at child tool pages", () => {
    const ready = LAB_TOOLS.filter((t) => t.status === "ready");
    expect(ready.map((t) => t.href).sort()).toEqual(
      ["/lab/going", "/lab/h2h", "/lab/pace", "/lab/pools"].sort(),
    );
  });

  it("lab.tsx is a layout with Outlet; wall UI lives on lab.index.tsx", () => {
    const layout = readFileSync("src/routes/lab.tsx", "utf8");
    expect(layout).toContain("Outlet");
    expect(layout).toContain('FeaturePageGate min="pro"');
    expect(layout).toContain('createFileRoute("/lab")');
    expect(layout).not.toContain("LAB_TOOLS");
    expect(layout).not.toContain("AppShell");

    expect(existsSync("src/routes/lab.index.tsx")).toBe(true);
    const index = readFileSync("src/routes/lab.index.tsx", "utf8");
    expect(index).toContain('createFileRoute("/lab/")');
    expect(index).toContain("LAB_TOOLS");
    expect(index).toContain("AppShell");
    expect(index).not.toContain("Outlet");
  });

  it("routeTree wires lab index + children under LabRoute", () => {
    const tree = readFileSync("src/routeTree.gen.ts", "utf8");
    expect(tree).toMatch(/LabIndexRoute/);
    expect(tree).toContain("getParentRoute: () => LabRoute");
    // Child tool paths remain nested under /lab
    for (const path of ["/lab/h2h", "/lab/pace", "/lab/going", "/lab/pools"]) {
      expect(tree).toContain(`fullPath: '${path}'`);
    }
  });
});
