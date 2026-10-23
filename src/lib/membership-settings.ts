export const MEMBERSHIP_SETTING_KEYS = ["paywall_threshold", "watch_limit_free_stage", "watch_limit_registered", "watch_limit_pro"] as const;
export type MembershipSettingKey = typeof MEMBERSHIP_SETTING_KEYS[number];

export function validateMembershipSettings(input: Record<MembershipSettingKey, number> & {raceday_alerts_enabled?: boolean}) {
  for (const key of MEMBERSHIP_SETTING_KEYS) {
    if (!Number.isInteger(input[key]) || input[key] <= 0 || input[key] > 100000) {
      throw new Error("設定必須為 1 至 100000 的整數");
    }
  }
  if (input.raceday_alerts_enabled !== undefined && typeof input.raceday_alerts_enabled !== "boolean") throw new Error("賽日提示設定必須為開或關");
  return {...Object.fromEntries(MEMBERSHIP_SETTING_KEYS.map(key => [key, input[key]])) as Record<MembershipSettingKey, number>, raceday_alerts_enabled: input.raceday_alerts_enabled ?? false};
}