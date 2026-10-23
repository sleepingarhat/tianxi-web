import { describe, expect, it } from "vitest";
import { passwordStrength } from "./password-strength";

describe("passwordStrength", () => {
  it("8 個字元或以上先算達標：8 字混合密碼過到長度檢查", () => {
    const r = passwordStrength("aB3defgh");
    expect(r.checks[0]).toEqual({ ok: true, label: "8 個字元或以上" });
  });

  it("7 個字元唔達標，強度封頂唔超過『弱』", () => {
    const r = passwordStrength("aB3defg");
    expect(r.checks[0]?.ok).toBe(false);
    expect(r.score).toBeLessThanOrEqual(1);
    expect(["太弱", "弱"]).toContain(r.label);
  });

  it("四項檢查為 8 字元或以上、大小寫英文、數字、符號；唔再要求 10 字元", () => {
    const labels = passwordStrength("aB3!defg").checks.map((c) => c.label);
    expect(labels).toEqual(["8 個字元或以上", "大小寫英文", "數字", "符號"]);
  });

  it("常見密碼會標記容易被估中", () => {
    expect(passwordStrength("12345678").common).toBe(true);
  });
});
