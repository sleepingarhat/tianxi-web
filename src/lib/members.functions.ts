import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MemberAccountStats = {
  total: number;
  confirmed: number;
  last7: number;
  last30: number;
  /** 近 30 日新登記而已驗證電郵 */
  confirmed30: number;
  /** 近 30 日新登記而已成功登入（完成會員註冊） */
  signedIn30: number;
  /** 已標記為測試帳號（唔計入以上數字） */
  tests: number;
};


type RpcClient = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};
type AuthContext = { supabase: RpcClient; userId: string };

/** 監控端專用：真實登記帳戶人數。DB 函數本身亦會再驗一次 admin，雙重把關。 */
export const getMemberAccountStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as AuthContext;
    const { data: isAdmin, error: roleError } = await ctx.supabase.rpc("has_role", {
      _user_id: ctx.userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) throw new Error("Forbidden：此帳號未獲授權進入監控端");

    const { data, error } = await ctx.supabase.rpc("member_account_stats");
    if (error) throw new Error("無法讀取會員人數");

    const row = (data ?? {}) as Partial<MemberAccountStats>;
    return {
      total: Number(row.total ?? 0),
      confirmed: Number(row.confirmed ?? 0),
      last7: Number(row.last7 ?? 0),
      last30: Number(row.last30 ?? 0),
      confirmed30: Number(row.confirmed30 ?? 0),
      signedIn30: Number(row.signedIn30 ?? 0),
      tests: Number(row.tests ?? 0),
    } satisfies MemberAccountStats;
  });

export type AdminMemberRow = {
  id: string;
  email: string | null;
  created_at: string;
  confirmed: boolean;
  last_sign_in_at: string | null;
  provider: string | null;
  is_admin: boolean;
  is_test: boolean;
};

async function assertAdmin(ctx: AuthContext) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden：此帳號未獲授權進入監控端");
}

/** 監控端專用：會員電郵清單（只限管理員）。 */
export const listAdminMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as AuthContext;
    await assertAdmin(ctx);
    const { data, error } = await ctx.supabase.rpc("admin_member_list");
    if (error) throw new Error("無法讀取會員清單");
    return (Array.isArray(data) ? data : []) as AdminMemberRow[];
  });

/** 標記／取消測試帳號；測試帳號唔計入設定的真實會員門檻。 */
export const setTestAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; isTest: boolean }) => {
    if (!/^[0-9a-f-]{36}$/i.test(input.userId)) throw new Error("無效帳戶");
    return { userId: input.userId, isTest: !!input.isTest };
  })
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as AuthContext;
    await assertAdmin(ctx);
    const { error } = await ctx.supabase.rpc("admin_set_test_account", { _user_id: data.userId, _is_test: data.isTest });
    if (error) throw new Error("更新失敗");
    return { ok: true };
  });
