import { describe, expect, it } from "vitest";
import { validateMembershipSettings } from "./membership-settings";

describe("會員設定", () => {
  const settings = { paywall_threshold: 200, watch_limit_free_stage: 30, watch_limit_registered: 3, watch_limit_pro: 90 };
  it("保留200名門檻", () => expect(validateMembershipSettings(settings).paywall_threshold).toBe(200));
  it("保留閘前30匹", () => expect(validateMembershipSettings(settings).watch_limit_free_stage).toBe(30));
  it("保留免費3匹", () => expect(validateMembershipSettings(settings).watch_limit_registered).toBe(3));
  it("保留Pro90匹", () => expect(validateMembershipSettings(settings).watch_limit_pro).toBe(90));
  it("拒絕零值", () => expect(() => validateMembershipSettings({ ...settings, paywall_threshold: 0 })).toThrow());
  it("拒絕小數", () => expect(() => validateMembershipSettings({ ...settings, watch_limit_pro: 1.5 })).toThrow());
  it("賽日提示預設關閉",()=>expect(validateMembershipSettings(settings).raceday_alerts_enabled).toBe(false));
  it("賽日提示接受boolean",()=>expect(validateMembershipSettings({...settings,raceday_alerts_enabled:true}).raceday_alerts_enabled).toBe(true));
});