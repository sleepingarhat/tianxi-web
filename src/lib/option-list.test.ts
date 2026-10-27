import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { shouldShowOptionList } from "./option-list";

describe("OptionListPicker 收起", () => {
  it("已揀、搜尋清空、失焦後收起；未揀、有焦點或有搜尋字就打開", () => {
    expect(shouldShowOptionList({ selectedId: "horse_E175", query: "", focused: false })).toBe(
      false,
    );
    expect(
      shouldShowOptionList({ selectedId: "trainer_蔡約翰", query: "   ", focused: false }),
    ).toBe(false);
    expect(shouldShowOptionList({ selectedId: "", query: "", focused: false })).toBe(true);
    expect(shouldShowOptionList({ selectedId: "horse_E175", query: "", focused: true })).toBe(true);
    expect(shouldShowOptionList({ selectedId: "horse_E175", query: "天火", focused: false })).toBe(
      true,
    );
    expect(shouldShowOptionList({ selectedId: "horse_E175", query: "天火", focused: true })).toBe(
      true,
    );
  });

  it("元件揀完會清空搜尋、blur，並跟 shouldShowOptionList 決定開合", () => {
    const src = readFileSync("src/components/tx/OptionListPicker.tsx", "utf8");
    expect(src).toContain("shouldShowOptionList({ selectedId, query, focused })");
    expect(src).toContain('onQueryChange("")');
    expect(src).toContain("inputRef.current?.blur()");
    expect(src).toContain("{open ? (");
    expect(src).toContain('role="listbox"');
  });
});
