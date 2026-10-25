import { fetchEntitlement, legacyEntitlement } from "./membership-entitlement.server";

/** 背景工作用：rpc membership_entitlement(uid)（service_role，drizzle 0044）；同網站／Worker 同一套規則（admin 亦當 Pro）。 */
export async function jobMembership(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { code?: string } | null }>;
  const e = await fetchEntitlement({
    callEntitlementRpc: () => rpc("membership_entitlement", { uid: userId }),
    legacy: async () => {
      const m = await supabaseAdmin.rpc("membership_for_notification_job", { uid: userId });
      if (m.error || !m.data) throw new Error("暫時未能核實會籍");
      return legacyEntitlement(userId, m.data);
    },
  });
  return { hasPro: e.tier === "pro", gateOpen: !!e.gateOpenAt };
}
