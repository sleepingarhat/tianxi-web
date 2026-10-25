import { resolveEntitlement, type SubRow } from "./entitlement";
import type { Tier } from "./tiers";

/**
 * 會籍權益單一真相來源：SQL `_membership_entitlement(uid)`（drizzle 0044）。
 * - 用戶請求：rpc `my_entitlement()`（用戶 JWT）——Worker（tianxi-racing backend/src/lib/pro-entitlement.ts）用同一個。
 * - 背景工作：rpc `membership_entitlement(uid)`（service_role）。
 * 付款環境只讀 app_settings.membership_payment_environment（已驗收＝live），唔再由 VITE token 推斷。
 */
export type DbEntitlement = {
  kind: string;
  hasPro: boolean;
  isAdmin: boolean;
  tier: Exclude<Tier, "guest">;
  rank: number | null;
  total: number;
  gateOpenAt: string | null;
  threshold: number;
  foundingSlots: number;
};

const KINDS = new Set([
  "free_stage",
  "founding",
  "founding_expired",
  "subscribed",
  "crypto_pass",
  "payment_failed",
  "none",
]);

type RawEntitlement = {
  kind?: unknown;
  has_pro?: unknown;
  is_admin?: unknown;
  rank?: unknown;
  total?: unknown;
  gate_open_at?: unknown;
  threshold?: unknown;
  founding_slots?: unknown;
};

export function parseEntitlementRow(raw: unknown): DbEntitlement {
  const r = raw as RawEntitlement | null;
  if (
    !r ||
    typeof r !== "object" ||
    typeof r.kind !== "string" ||
    !KINDS.has(r.kind) ||
    typeof r.has_pro !== "boolean" ||
    typeof r.is_admin !== "boolean"
  )
    throw new Error("暫時未能核實會籍");
  const hasPro = r.has_pro === true;
  const isAdmin = r.is_admin === true;
  return {
    kind: isAdmin && !hasPro ? "admin" : r.kind,
    hasPro,
    isAdmin,
    tier: hasPro || isAdmin ? "pro" : "registered",
    rank: typeof r.rank === "number" ? r.rank : null,
    total: typeof r.total === "number" ? r.total : 0,
    gateOpenAt: typeof r.gate_open_at === "string" ? r.gate_open_at : null,
    threshold: Number(r.threshold),
    foundingSlots: Number(r.founding_slots),
  };
}

type RpcResult = { data: unknown; error: { code?: string; message?: string } | null };
export type EntitlementDeps = {
  /** 呼叫新 RPC（my_entitlement 或 membership_entitlement）。 */
  callEntitlementRpc: () => PromiseLike<RpcResult>;
  /** 過渡：0044 未套用時用舊 TS 規則。 */
  legacy: () => Promise<DbEntitlement>;
};

/** 0044 未套用時 PostgREST 會回 PGRST202（函數唔存在）；只有呢個情況先用過渡路徑，其他錯誤一律 fail closed。 */
export function isMissingFunction(error: { code?: string } | null): boolean {
  return !!error && (error.code === "PGRST202" || error.code === "42883");
}

export async function fetchEntitlement(deps: EntitlementDeps): Promise<DbEntitlement> {
  const res = await deps.callEntitlementRpc();
  if (!res.error) return parseEntitlementRow(res.data);
  if (isMissingFunction(res.error)) return deps.legacy();
  throw new Error("暫時未能核實會籍");
}

/**
 * 過渡路徑（0044 套用後應刪除）：同 resolveEntitlement 一樣，但付款環境照樣由 DB 設定讀（service_role），唔睇 VITE。
 */
export async function legacyEntitlement(
  userId: string,
  membership: unknown,
): Promise<DbEntitlement> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const row = membership as {
    rank: number | null;
    total: number;
    gate_open_at: string | null;
    threshold: number;
    founding_slots: number;
  } | null;
  if (!row) throw new Error("暫時未能核實會籍");
  const envRow = await db
    .from("app_settings")
    .select("value")
    .eq("key", "membership_payment_environment")
    .maybeSingle();
  if (envRow.error) throw new Error("暫時未能核實付款環境");
  const environment = envRow.data?.value ?? "sandbox";
  if (environment !== "live" && environment !== "sandbox") throw new Error("付款環境設定無效");
  const [sub, admin, pass] = await Promise.all([
    db
      .from("subscriptions")
      .select("status,current_period_end,cancel_at_period_end")
      .eq("user_id", userId)
      .eq("environment", environment)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.rpc("has_role", { _user_id: userId, _role: "admin" }),
    db.rpc("crypto_pass_until", { uid: userId, env: environment }),
  ]);
  if (sub.error || admin.error || pass.error) throw new Error("暫時未能核實會員權限");
  const e = resolveEntitlement({
    rank: row.rank,
    total: row.total,
    gateOpenAt: row.gate_open_at,
    threshold: row.threshold,
    foundingSlots: row.founding_slots,
    subscription: sub.data as SubRow | null,
    cryptoPassUntil: pass.data,
  });
  return parseEntitlementRow({
    kind: e.kind,
    has_pro: e.hasPro,
    is_admin: admin.data === true,
    rank: row.rank,
    total: row.total,
    gate_open_at: row.gate_open_at,
    threshold: row.threshold,
    founding_slots: row.founding_slots,
  });
}
