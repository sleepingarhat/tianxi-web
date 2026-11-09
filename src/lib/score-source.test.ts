import { describe, expect, it } from "vitest";
import { isLgbScoreSource } from "./score-source";

describe("模型來源", () => {
  it("lgb 同描述字串都當天喜LGB", () => {
    expect(isLgbScoreSource("lgb")).toBe(true);
    expect(isLgbScoreSource("tx-oracle-v3 (lgb=12/12, elo=v12)")).toBe(true);
  });
  it("覆蓋0匹或其他來源係基準", () => {
    expect(isLgbScoreSource("tx-oracle-v3 (lgb=0/12)")).toBe(false);
    expect(isLgbScoreSource("elo")).toBe(false);
  });
  it("冇資料唔當LGB", () => {
    expect(isLgbScoreSource(undefined)).toBe(false);
  });
});
