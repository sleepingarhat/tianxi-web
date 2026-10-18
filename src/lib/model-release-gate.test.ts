import { describe, expect, it } from "vitest";
import { canPromoteModel, type ReleaseEvidence } from "./model-release-gate";

const verified: ReleaseEvidence = {
  calibratedServingReplay: true, missingAxisParity: true,
  dailyResearchGate: "PASS", immutableHistoryVerified: true,
};
describe("升版底線", () => {
  it("逐日研究閘未過不可升版", () => {
    expect(canPromoteModel({ ...verified, dailyResearchGate: "FAIL" })).toBe(false);
    expect(canPromoteModel({ ...verified, dailyResearchGate: "UNVERIFIED" })).toBe(false);
  });
  it("原始分數敏感度不能取代正式校準融合", () => {
    expect(canPromoteModel({ ...verified, calibratedServingReplay: false })).toBe(false);
  });
  it("缺軸處理未核實不能升版", () => {
    expect(canPromoteModel({ ...verified, missingAxisParity: false })).toBe(false);
  });
  it("歷史凍結與副本未核實不變不能升版", () => {
    expect(canPromoteModel({ ...verified, immutableHistoryVerified: false })).toBe(false);
  });
  it("所有必要證據齊全才有升版資格", () => {
    expect(canPromoteModel(verified)).toBe(true);
  });
});