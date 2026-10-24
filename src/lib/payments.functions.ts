import { createServerFn } from "@tanstack/react-start";
import type Stripe from "stripe";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";
import { resolveEntitlement, type SubRow } from "@/lib/entitlement";
import { customerBelongsToUser } from "./audit-safety";
import { DEFAULT_PAYWALL_THRESHOLD, FOUNDING_SLOTS } from "./freeStage";

const PRO_PRICE_ID = "pro_weekly";

type Ctx = { supabase: any; userId: string; claims: { email?: string } };

async function loadMembership(ctx: Ctx, environment: StripeEnv) {
  const { data: m, error } = await ctx.supabase.rpc("my_membership");
  if (error) throw new Error("無法讀取會籍");
  const { data: sub, error: subError } = await ctx.supabase
    .from("subscriptions")
    .select("status, current_period_end, cancel_at_period_end, stripe_customer_id")
    .eq("user_id", ctx.userId)
    .eq("environment", environment)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (subError) throw new Error("無法讀取訂閱紀錄");
  const pass=await ctx.supabase.rpc('crypto_pass_until',{uid:ctx.userId,env:environment});
  if(pass.error)throw new Error('無法讀取通行證紀錄');
  const row = (m ?? {}) as { rank?: number; total?: number; gate_open_at?: string | null; threshold?: number; founding_slots?: number };
  const entitlement = resolveEntitlement({
    rank: row.rank ?? null,
    total: row.total ?? 0,
    gateOpenAt: row.gate_open_at ?? null,
    subscription: (sub as SubRow | null) ?? null,
    threshold: row.threshold ?? DEFAULT_PAYWALL_THRESHOLD,
    foundingSlots: row.founding_slots ?? FOUNDING_SLOTS,
    cryptoPassUntil:pass.data,
  });
  return { rank: row.rank ?? null, total: row.total ?? 0, gateOpenAt: row.gate_open_at ?? null, threshold: row.threshold, foundingSlots: row.founding_slots, entitlement, customerId: (sub as { stripe_customer_id?: string | null } | null)?.stripe_customer_id ?? null };
}

export const getMyMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { environment: StripeEnv }) => d)
  .handler(async ({ data, context }) => {
    const r = await loadMembership(context as unknown as Ctx, data.environment);
    return { rank: r.rank, total: r.total, gateOpenAt: r.gateOpenAt, threshold: r.threshold, foundingSlots: r.foundingSlots, entitlement: r.entitlement, hasBilling: !!r.customerId };
  });

async function resolveOrCreateCustomer(stripe: Stripe, options: { email?: string | undefined; userId: string }): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Invalid userId");
  const found = await stripe.customers.search({ query: `metadata['userId']:'${options.userId}'`, limit: 1 });
  const f = found.data[0]; if (f) return f.id;
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    const c = existing.data[0];
    if (c && customerBelongsToUser(c.metadata, options.userId)) {
      return c.id;
    }
  }
  const created = await stripe.customers.create({ ...(options.email && { email: options.email }), metadata: { userId: options.userId } });
  return created.id;
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { returnUrl: string; environment: StripeEnv }) => d)
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    const ctx = context as unknown as Ctx;
    const m = await loadMembership(ctx, data.environment);
    if (!m.gateOpenAt || !Number.isFinite(Date.parse(m.gateOpenAt))) return { error: "收費閘未開，現階段唔收款。" };
    if (m.entitlement.hasPro) return { error: "你已經係 Pro 會員，唔使再訂閱。" };
    try {
      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [PRO_PRICE_ID] });
      const price = prices.data[0]; if (!price) throw new Error("Price not found");
      const customerId = await resolveOrCreateCustomer(stripe, { email: ctx.claims?.email, userId: ctx.userId });
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: price.id, quantity: 1 }],
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        managed_payments: { enabled: true },
        metadata: { userId: ctx.userId, managed_payments: "true" },
        subscription_data: { metadata: { userId: ctx.userId } },
      } as Stripe.Checkout.SessionCreateParams);
      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { returnUrl: string; environment: StripeEnv }) => d)
  .handler(async ({ data, context }): Promise<{ url: string } | { error: string }> => {
    const m = await loadMembership(context as unknown as Ctx, data.environment);
    if (!m.customerId) return { error: "搵唔到你嘅訂閱紀錄。" };
    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({ customer: m.customerId, return_url: data.returnUrl });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
