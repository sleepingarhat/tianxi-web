import { describe, expect, it } from "vitest";
import { normalizeFocus, normalizeLastRun } from "./raceday-official";

describe("race-day focus / last-run projection", () => {
  it("always links the focus to the official HKJC page, never a stored URL", () => {
    const f = normalizeFocus([{ title: "猛男複製輝煌戰績", lead: "導語", url: "https://evil.example" }]);
    expect(f?.url).toBe("https://racing.hkjc.com/zh-hk/local/page/raceday-focus");
  });
  it("hides an untitled focus", () => {
    expect(normalizeFocus([{ title: " " }])).toBeNull();
  });
  it("drops last-run rows without memo and sorts by race then horse", () => {
    const rows = normalizeLastRun([
      { raceNumber: 2, horseNumber: 8, horseName: "多利神駒", lastDate: "2026-10-14", memo: "好地" },
      { raceNumber: 1, horseNumber: 2, horseName: "燊輝之星", lastDate: "2026-09-27", memo: "好至快地" },
      { raceNumber: 3, horseNumber: 3, horseName: "長勝金剛", lastDate: "2026-10-21", memo: "" },
    ]);
    expect(rows.map((r) => r.horseName)).toEqual(["燊輝之星", "多利神駒"]);
  });
});
