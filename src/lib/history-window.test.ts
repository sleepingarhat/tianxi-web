import { describe, expect, it } from "vitest";
import { truncateRecent } from "./history-window";

describe("truncateRecent", () => {
  it("超過上限時截斷並標示 truncated，保留最新嘅 limit 筆", () => {
    const rows = ["2026-01-01", "2025-06-01", "2026-10-19", "2026-05-05"];
    const out = truncateRecent(rows, 2, (d) => d);
    expect(out.truncated).toBe(true);
    expect(out.items).toEqual(["2026-10-19", "2026-05-05"]);
  });

  it("未超上限時全部保留且 truncated=false", () => {
    const rows = ["2026-01-01", "2026-10-19"];
    const out = truncateRecent(rows, 400, (d) => d);
    expect(out.truncated).toBe(false);
    expect(out.items).toEqual(["2026-10-19", "2026-01-01"]);
  });

  it("物件用 key 函數排序，相同 key 保持穩定輸入次序", () => {
    const rows = [
      { version: "v10", firstDate: "2026-01-01" },
      { version: "v12", firstDate: "2026-03-01" },
      { version: "v11", firstDate: "2026-02-01" },
    ];
    const out = truncateRecent(rows, 1, (r) => r.firstDate);
    expect(out.truncated).toBe(true);
    expect(out.items).toEqual([{ version: "v12", firstDate: "2026-03-01" }]);
  });

  it("空輸入唔會標示截斷", () => {
    const out = truncateRecent([], 400, (d) => d);
    expect(out.truncated).toBe(false);
    expect(out.items).toEqual([]);
  });
});
