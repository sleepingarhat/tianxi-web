export const MEMBERSHIP_SETTING_KEYS = ["paywall_threshold", "watch_limit_free_stage", "watch_limit_registered", "watch_limit_pro"] as const;
export type MembershipSettingKey = typeof MEMBERSHIP_SETTING_KEYS[number];

export function validateMembershipSettings(input: Record<MembershipSettingKey, number>) {
  for (const key of MEMBERSHIP_SETTING_KEYS) {
    if (!Number.isInteger(input[key]) || input[key] <= 0 || input[key] > 100000) {
      throw new Error("設定必須為 1 至 100000 的整數");
    }
  }
  return Object.fromEntries(MEMBERSHIP_SETTING_KEYS.map(key => [key, input[key]])) as Record<MembershipSettingKey, number>;
}