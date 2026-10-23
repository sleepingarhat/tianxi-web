import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MEMBERSHIP_SETTING_KEYS, validateMembershipSettings, type MembershipSettingKey } from "./membership-settings";
import { DEFAULT_PAYWALL_THRESHOLD, WATCH_LIMITS } from "./freeStage";

export const getMembershipSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || admin !== true) throw new Error("此操作只限管理員");
    const [settings, membership] = await Promise.all([
      context.supabase.from("app_settings").select("key,value").in("key", [...MEMBERSHIP_SETTING_KEYS, 'raceday_alerts_enabled']),
      context.supabase.rpc("my_membership"),
    ]);
    if (settings.error || membership.error || !membership.data) throw new Error("暫時未能讀取會員設定");
    const values: Record<MembershipSettingKey, number> = { paywall_threshold: DEFAULT_PAYWALL_THRESHOLD, watch_limit_free_stage: WATCH_LIMITS.free_stage, watch_limit_registered: WATCH_LIMITS.registered, watch_limit_pro: WATCH_LIMITS.pro };
    for (const key of MEMBERSHIP_SETTING_KEYS) {
      const value = settings.data?.find(row => row.key === key)?.value;
      if (typeof value === "number") values[key] = value;
    }
    const member = membership.data as unknown as { total: number; gate_open_at: string | null; founding_slots: number };
    return { values: {...values, raceday_alerts_enabled: settings.data?.find(row=>row.key==='raceday_alerts_enabled')?.value === true}, total: member.total, gateOpenAt: member.gate_open_at, foundingSlots: member.founding_slots };
  });

export const saveMembershipSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateMembershipSettings)
  .handler(async ({ data, context }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || admin !== true) throw new Error("此操作只限管理員");
    const { data: member, error: memberError } = await context.supabase.rpc("my_membership");
    if (memberError || !member) throw new Error("暫時未能核實收費閘");
    const gateOpenAt = (member as unknown as { gate_open_at: string | null }).gate_open_at;
    const keys = gateOpenAt ? MEMBERSHIP_SETTING_KEYS.filter(key => key !== "paywall_threshold") : MEMBERSHIP_SETTING_KEYS;
    const rows: {key:string;value:number|boolean;updated_by:string}[] = keys.map(key => ({ key, value: data[key], updated_by: context.userId }));
    rows.push({key:"raceday_alerts_enabled",value:data.raceday_alerts_enabled,updated_by:context.userId});
    const { error } = await context.supabase.from("app_settings").upsert(rows);
    if (error) throw new Error("會員設定未能儲存");
    return { ok: true };
  });

export const openMembershipGate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || admin !== true) throw new Error("此操作只限管理員");
    const { error } = await context.supabase.rpc("admin_open_gate_now");
    if (error) throw new Error("未能開啟收費閘");
    return { ok: true };
  });