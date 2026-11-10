import { describe, expect, it, vi } from "vitest";
import { checkoutReturnUrl, portalReturnUrl } from "./payment-return-url";

const provider = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = { middleware: () => chain, inputValidator: () => chain, handler: (fn: unknown) => fn };
    return chain;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/stripe.server", () => ({ createStripeClient: provider.create, getStripeErrorMessage: String }));
import { createCheckoutSession, createPortalSession } from "./payments.functions";

describe("付款完只可以返 tianxi.racing", () => {
  it("正式收費：tianxi.racing 嘅返回頁由伺服器固定", () => {
    expect(checkoutReturnUrl("https://tianxi.racing/anything?x=1", "live")).toBe("https://tianxi.racing/checkout/return?session_id={CHECKOUT_SESSION_ID}");
    expect(portalReturnUrl("https://www.tianxi.racing/membership?tab=a#top", "live")).toBe("https://www.tianxi.racing/membership?tab=a");
  });

  it.each([
    "https://evil.example/checkout/return",
    "https://tianxi.racing.evil.example/",
    "https://evil.example@tianxi.racing/",
    "https://user:pw@tianxi.racing/",
    "http://tianxi.racing/",
    "https://tianxi.racing:8443/",
    "javascript:alert(1)",
    "/membership",
    "",
  ])("正式收費拒絕外站或可疑網址：%s", (raw) => {
    expect(checkoutReturnUrl(raw, "live")).toBeNull();
    expect(portalReturnUrl(raw, "live")).toBeNull();
  });

  it("預覽同本機只限測試付款", () => {
    const preview = "https://id-preview--8be5fecb-440e-4e5c-94dc-cbdc1f31edcd.lovable.app/membership";
    expect(portalReturnUrl(preview, "live")).toBeNull();
    expect(portalReturnUrl(preview, "sandbox")).toBe(preview);
    expect(portalReturnUrl("http://localhost:8080/membership", "live")).toBeNull();
    expect(portalReturnUrl("http://localhost:8080/membership", "sandbox")).toBe("http://localhost:8080/membership");
  });
});

function context(gate: string | null, customerId: string | null) {
  const query: Record<string, unknown> = {};
  for (const name of ["select", "eq", "order", "limit"]) query[name] = () => query;
  query["maybeSingle"] = async () => ({ data: customerId ? { status: "canceled", current_period_end: null, cancel_at_period_end: false, stripe_customer_id: customerId } : null, error: null });
  return {
    userId: "test-owner", claims: {}, supabase: {
      rpc: async (name: string) => ({ data: name === "my_membership" ? { rank: 201, total: 201, threshold: 200, founding_slots: 200, gate_open_at: gate } : null, error: null }),
      from: () => query,
    },
  };
}

describe("外站返回網址唔會去到付款服務", () => {
  it("帳單管理拒絕外站，唔建立付款服務連線", async () => {
    provider.create.mockClear();
    const invoke = createPortalSession as unknown as (input: unknown) => Promise<unknown>;
    expect(await invoke({ data: { environment: "live", returnUrl: "https://evil.example/" }, context: context(null, "cus_owner") })).toEqual({ error: "返回網址不正確。" });
    expect(provider.create).not.toHaveBeenCalled();
  });

  it("開閘後收費頁都拒絕外站，唔建立付款服務連線", async () => {
    provider.create.mockClear();
    const invoke = createCheckoutSession as unknown as (input: unknown) => Promise<unknown>;
    expect(await invoke({ data: { environment: "live", returnUrl: "https://evil.example/checkout/return" }, context: context("2026-11-01T00:00:00Z", null) })).toEqual({ error: "返回網址不正確。" });
    expect(provider.create).not.toHaveBeenCalled();
  });

  it("帳單管理用 tianxi.racing 返回網址先會交俾付款服務", async () => {
    const create = vi.fn(async () => ({ url: "https://billing.stripe.com/p/session" }));
    provider.create.mockReset().mockReturnValue({ billingPortal: { sessions: { create } } });
    const invoke = createPortalSession as unknown as (input: unknown) => Promise<unknown>;
    expect(await invoke({ data: { environment: "live", returnUrl: "https://tianxi.racing/membership" }, context: context(null, "cus_owner") })).toEqual({ url: "https://billing.stripe.com/p/session" });
    expect(create).toHaveBeenCalledWith({ customer: "cus_owner", return_url: "https://tianxi.racing/membership" });
  });
});
