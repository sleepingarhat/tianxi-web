import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

import {
  GOING_COURSE_OPTIONS,
  formatPp,
  formatRate,
  heatTone,
  meetingListOptions,
  parseDistanceChoice,
  parseVenueInput,
} from "./lab-going-ui";
import { filterListOptions } from "./option-list";

describe("lab-going-ui", () => {
  it("formats rates and pp", () => {
    expect(formatRate(0.25)).toBe("25.0%");
    expect(formatRate(null)).toBe("—");
    expect(formatPp(0.05)).toBe("+5.0pp");
    expect(formatPp(-0.02)).toBe("-2.0pp");
  });

  it("marks sparse / null as gray", () => {
    expect(heatTone(0.1, true)).toBe("gray");
    expect(heatTone(null, false)).toBe("gray");
    expect(heatTone(0.05, false)).toBe("pos");
    expect(heatTone(-0.05, false)).toBe("neg");
    expect(heatTone(0.01, false)).toBe("neutral");
  });

  it("parses venue", () => {
    expect(parseVenueInput("ST")).toBe("ST");
    expect(parseVenueInput("沙田")).toBe("ST");
    expect(parseVenueInput("x")).toBeNull();
  });

  it("賽日清單用日期馬場，唔要求用戶打 id", () => {
    const opts = meetingListOptions([
      { id: "2026-10-25_ST", date: "2026-10-25", venue: "ST", venueName: "沙田", trackCondition: "好地至快地" },
    ]);
    expect(opts[0]?.id).toBe("");
    expect(opts[1]?.label).toBe("2026-10-25 · 沙田");
    expect(opts[1]?.hint).toBe("好地至快地");
    expect(filterListOptions(opts, "沙田").map((o) => o.id)).toEqual(["", "2026-10-25_ST"]);
    expect(parseDistanceChoice("1200")).toBe(1200);
    expect(parseDistanceChoice("")).toBeUndefined();
    expect(parseDistanceChoice("12")).toBeUndefined();
    expect(GOING_COURSE_OPTIONS.some((o) => o.id === '草地 - "C+3" 賽道')).toBe(true);
  });

  it("場地頁用清單揀選，唔再自由輸入 meetingId", () => {
    const src = readFileSync("src/routes/lab.going.tsx", "utf8");
    expect(src).toContain("OptionListPicker");
    expect(src).not.toContain("meetingId（");
    expect(src).not.toContain("e.g. C+3");
    expect(src).toContain("清單揀選");
  });
});
