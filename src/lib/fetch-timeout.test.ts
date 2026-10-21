import { describe, expect, it } from "vitest";
import { isTimeoutError, timeoutSignal } from "./fetch-timeout";

describe("timeoutSignal", () => {
  it("逾時後中止並標為 TimeoutError", async () => {
    const signal = timeoutSignal(5);
    expect(signal).not.toBeNull();
    await new Promise((r) => setTimeout(r, 30));
    expect(signal?.aborted).toBe(true);
    expect(isTimeoutError(signal?.reason)).toBe(true);
  });
  it("一般錯誤唔當逾時", () => {
    expect(isTimeoutError(new Error("fetch failed"))).toBe(false);
    expect(isTimeoutError(undefined)).toBe(false);
  });
});
