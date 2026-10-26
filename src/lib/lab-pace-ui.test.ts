import { describe, expect, it } from "vitest";
import {
  PACE_DISCLAIMER,
  deltaTone,
  forecastTone,
  formatDelta,
  formatSectionTime,
  positionToY,
  roleTone,
  sectionLabel,
  validateRaceIdInput,
} from "./lab-pace-ui";

describe("lab-pace-ui", () => {
  it("disclaimer 合規", () => {
    expect(PACE_DISCLAIMER).toBe("研究提示・唔入排名");
  });

  it("validateRaceIdInput 接受標準／缺前綴", () => {
    expect(validateRaceIdInput("race_2026-10-26_ST_1")).toBe("race_2026-10-26_ST_1");
    expect(validateRaceIdInput("2026-10-26_HV_8")).toBe("race_2026-10-26_HV_8");
    expect(validateRaceIdInput("")).toBeNull();
    expect(validateRaceIdInput("race_bad")).toBeNull();
  });

  it("format helpers", () => {
    expect(formatSectionTime(12.345)).toBe("12.35s");
    expect(formatSectionTime(null)).toBe("—");
    expect(formatDelta(-0.2)).toBe("-0.20s");
    expect(formatDelta(0.15)).toBe("+0.15s");
    expect(deltaTone(-0.2)).toBe("win");
    expect(deltaTone(0.2)).toBe("lose");
    expect(forecastTone("快")).toBe("lose");
    expect(forecastTone("慢")).toBe("win");
    expect(roleTone("leader")).toBe("lose");
    expect(roleTone("held-up")).toBe("win");
  });

  it("positionToY 第1在頂、最大在底", () => {
    expect(positionToY(1, 14, 100, 10)).toBe(10);
    expect(positionToY(14, 14, 100, 10)).toBe(90);
  });

  it("sectionLabel", () => {
    expect(sectionLabel(1, 4)).toBe("早段");
    expect(sectionLabel(4, 4)).toBe("末段");
    expect(sectionLabel(2, 4)).toBe("第2段");
  });
});
