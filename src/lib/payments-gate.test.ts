import { describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = { middleware: () => chain, inputValidator: () => chain, handler: (fn: unknown) => fn };
    return chain;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/stripe.server", () => ({ createStripeClient: provider.create, getStripeErrorMessage: String }));
import { createCheckoutSession } from "./payments.functions";

describe("關閘不可建立付費訂閱", () => {
  it.each([null, "invalid-date"])("200名門檻已達且過往扣款失敗仍不得收款：%s", async (gate) => {
    provider.create.mockClear();
    const query: Record<string, unknown> = {};
    for (const name of ["select", "eq", "order", "limit"]) query[name] = () => query;
    query.maybeSingle = async () => ({ data: { status: "past_due", current_period_end: null, cancel_at_period_end: false }, error: null });
    const context = {
      userId: "test-owner", claims: {}, supabase: {
        rpc: async (name: string) => ({ data: name === "my_membership" ? { rank: 201, total: 201, threshold: 200, founding_slots: 200, gate_open_at: gate } : null, error: null }),
        from: () => query,
      },
    };
    const invoke = createCheckoutSession as unknown as (input: unknown) => Promise<unknown>;
    expect(await invoke({ data: { environment: "live", returnUrl: "https://tianxi.racing/membership" }, context })).toEqual({ error: "收費閘未開，現階段唔收款。" });
    expect(provider.create).not.toHaveBeenCalled();
  });
});