import { describe, expect, it } from "vitest";

import {
  formatPp,
  formatRate,
  heatTone,
  parseVenueInput,
} from "./lab-going-ui";

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
});
