import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchEntitlement, legacyEntitlement } from "./membership-entitlement.server";
import { DEFAULT_PAYWALL_THRESHOLD, FOUNDING_SLOTS, WATCH_LIMITS } from "./freeStage";
import { tierHas, type Tier } from "./tiers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function loadUserTier(client: SupabaseClient<Database>, userId: string) {
  // 單一真相來源：rpc my_entitlement()（drizzle 0044），Worker 用同一個。types.ts 係自動生成，未有新函數，所以用窄型別呼叫。
  const rpc = client.rpc.bind(client) as unknown as (
    fn: string,
  ) => PromiseLike<{ data: unknown; error: { code?: string } | null }>;
  const [entitlement, settings] = await Promise.all([
    fetchEntitlement({
      callEntitlementRpc: () => rpc("my_entitlement"),
      legacy: async () => {
        const m = await client.rpc("my_membership");
        if (m.error) throw new Error("暫時未能核實會籍");
        return legacyEntitlement(userId, m.data);
      },
    }),
    client
      .from("app_settings")
      .select("key,value")
      .in("key", ["watch_limit_free_stage", "watch_limit_registered", "watch_limit_pro"]),
  ]);
  if (settings.error) throw new Error("暫時未能核實會員權限");
  const tier: Tier = entitlement.tier;
  const threshold = Number.isFinite(entitlement.threshold)
    ? entitlement.threshold
    : DEFAULT_PAYWALL_THRESHOLD;
  const foundingSlots = Number.isFinite(entitlement.foundingSlots)
    ? entitlement.foundingSlots
    : FOUNDING_SLOTS;
  const limitKey = !entitlement.gateOpenAt ? "free_stage" : tier === "pro" ? "pro" : "registered";
  const configured = settings.data?.find((s) => s.key === `watch_limit_${limitKey}`)?.value;
  const watchLimit =
    typeof configured === "number" && Number.isInteger(configured) && configured > 0
      ? configured
      : WATCH_LIMITS[limitKey];
  return {
    tier,
    isAdmin: entitlement.isAdmin,
    entitlementKind: entitlement.kind,
    gateOpen: !!entitlement.gateOpenAt,
    total: entitlement.total,
    threshold,
    foundingSlots,
    remaining: Math.max(0, threshold - entitlement.total),
    watchLimit,
  };
}

export function requireTier(min: "registered" | "pro") {
  return createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ context, next }) => {
      const info = await loadUserTier(context.supabase, context.userId);
      if (!tierHas(info.tier, min))
        throw new Response(`此功能需要${min === "pro" ? "Pro 會員" : "註冊會員"}`, { status: 403 });
      return next({ context: { tier: info.tier, watchLimit: info.watchLimit } });
    });
}
