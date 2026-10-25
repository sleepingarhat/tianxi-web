import { describe, expect, it, vi } from "vitest";
import {
  fetchEntitlement,
  isMissingFunction,
  parseEntitlementRow,
} from "./membership-entitlement.server";

const row = (over: Record<string, unknown> = {}) => ({
  kind: "none",
  has_pro: false,
  is_admin: false,
  tier: "registered",
  rank: 12,
  total: 40,
  gate_open_at: "2026-10-01T00:00:00Z",
  threshold: 100,
  founding_slots: 10,
  environment: "live",
  ...over,
});

describe("會籍單一來源（rpc my_entitlement／membership_entitlement）", () => {
  it("解析：免費會員", () => {
    expect(parseEntitlementRow(row())).toMatchObject({
      kind: "none",
      tier: "registered",
      hasPro: false,
      gateOpenAt: "2026-10-01T00:00:00Z",
    });
  });
  it("解析：has_pro → pro；admin 一律 pro", () => {
    expect(parseEntitlementRow(row({ kind: "subscribed", has_pro: true })).tier).toBe("pro");
    expect(parseEntitlementRow(row({ is_admin: true }))).toMatchObject({
      tier: "pro",
      kind: "admin",
      isAdmin: true,
    });
  });
  it("解析：唔認得／缺欄位 → fail closed", () => {
    for (const bad of [
      null,
      "x",
      row({ kind: "vip" }),
      row({ has_pro: "true" }),
      row({ is_admin: undefined }),
    ])
      expect(() => parseEntitlementRow(bad)).toThrow();
  });
  it("RPC 成功就唔行過渡路徑", async () => {
    const legacy = vi.fn();
    const e = await fetchEntitlement({
      callEntitlementRpc: async () => ({
        data: row({ kind: "crypto_pass", has_pro: true }),
        error: null,
      }),
      legacy,
    });
    expect(e.tier).toBe("pro");
    expect(legacy).not.toHaveBeenCalled();
  });
  it("只有函數未存在（0044 未套用）先用過渡路徑", async () => {
    const legacy = vi.fn(async () => parseEntitlementRow(row()));
    await fetchEntitlement({
      callEntitlementRpc: async () => ({ data: null, error: { code: "PGRST202" } }),
      legacy,
    });
    expect(legacy).toHaveBeenCalledOnce();
    expect(isMissingFunction({ code: "42883" })).toBe(true);
  });
  it("其他錯誤（權限、網絡）→ 拋錯，唔會靜靜雞當免費或 Pro", async () => {
    const legacy = vi.fn();
    await expect(
      fetchEntitlement({
        callEntitlementRpc: async () => ({ data: null, error: { code: "42501" } }),
        legacy,
      }),
    ).rejects.toThrow();
    expect(legacy).not.toHaveBeenCalled();
  });
});
