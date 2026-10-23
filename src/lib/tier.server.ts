import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveEntitlement, type SubRow } from "./entitlement";
import { DEFAULT_PAYWALL_THRESHOLD, FOUNDING_SLOTS, WATCH_LIMITS } from "./freeStage";
import { tierHas, type Tier } from "./tiers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function loadUserTier(client: SupabaseClient<Database>, userId: string) {
  const { data: membership, error } = await client.rpc("my_membership");
  if (error || !membership) throw new Error("暫時未能核實會籍");
  const row = membership as unknown as { rank: number | null; total: number; gate_open_at: string | null; threshold: number; founding_slots: number };
  // Match the actual checkout environment, never infer it from secret presence.
  const token = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;
  const environment = token?.startsWith("pk_live_") ? "live" : "sandbox";
  const [sub, admin, settings] = await Promise.all([
    client.from("subscriptions").select("status,current_period_end,cancel_at_period_end").eq("user_id",userId).eq("environment", environment).order("created_at",{ ascending: false }).limit(1).maybeSingle(),
    client.rpc("has_role", { _user_id: userId, _role: "admin" }),
    client.from("app_settings").select("key,value").in("key",["watch_limit_free_stage","watch_limit_registered","watch_limit_pro"]),
  ]);
  if (sub.error || admin.error || settings.error) throw new Error("暫時未能核實會員權限");
  const entitlement = resolveEntitlement({ rank: row.rank, total: row.total, gateOpenAt: row.gate_open_at, threshold: row.threshold, foundingSlots: row.founding_slots, subscription: sub.data as SubRow | null });
  const isAdmin = admin.data === true;
  const tier: Tier = isAdmin || entitlement.hasPro ? "pro" : "registered";
  const limitKey = !row.gate_open_at ? "free_stage" : tier === "pro" ? "pro" : "registered";
  const configured = settings.data?.find(s => s.key === `watch_limit_${limitKey}`)?.value;
  const watchLimit = typeof configured === "number" && Number.isInteger(configured) && configured > 0 ? configured : WATCH_LIMITS[limitKey];
  return { tier, isAdmin, entitlementKind: entitlement.kind, gateOpen: !!row.gate_open_at, total: row.total, threshold: row.threshold ?? DEFAULT_PAYWALL_THRESHOLD, foundingSlots: row.founding_slots ?? FOUNDING_SLOTS, remaining: Math.max(0,(row.threshold ?? DEFAULT_PAYWALL_THRESHOLD)-row.total), watchLimit };
}

export function requireTier(min: "registered" | "pro") {
  return createMiddleware({ type: "function" }).middleware([requireSupabaseAuth]).server(async ({ context, next }) => {
    const info = await loadUserTier(context.supabase, context.userId);
    if (!tierHas(info.tier,min)) throw new Response(`此功能需要${min === "pro" ? "Pro 會員" : "註冊會員"}`, { status: 403 });
    return next({ context: { tier: info.tier, watchLimit: info.watchLimit } });
  });
}