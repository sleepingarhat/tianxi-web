import { afterEach, describe, expect, it, vi } from "vitest";
import { featureReadDeadline } from "./feature-read-deadline";

afterEach(() => vi.useRealTimers());
describe("特徵讀取等待", () => {
  it("成功原樣返回", async () => expect(await featureReadDeadline(Promise.resolve({ rows: 22 }))).toEqual({ rows: 22 }));
  it("失敗不當空資料", async () => { await expect(featureReadDeadline(Promise.reject(new Error("failed")))).rejects.toThrow("failed"); });
  it("超時可停止等待", async () => {
    vi.useFakeTimers();
    const read = featureReadDeadline(new Promise<never>(() => {}));
    const result = expect(read).rejects.toThrow("請重新讀取");
    await vi.advanceTimersByTimeAsync(90_000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });
});