import { describe, it, expect } from "vitest";
import { cardAccess, projectCardPicks, projectRacePicks, predictorAllowed, projectMemberRows, projectMeetingDates, explainTier } from "./tier-projection";
import { FEATURE_TIERS } from "./tiers";
import { resolveEntitlement } from "./entitlement";

const picks = [{ nameCh: "首選", pWin: 0.4 }, { nameCh: "第二選", pWin: 0.2 }];
describe("第二份會員分級", () => {
  it("訪客可見第一場完整預測", () => expect(projectCardPicks(picks, "guest", 1)).toEqual(picks));
  it("訪客第二場不可見馬名或機率", () => expect(projectCardPicks(picks, "guest", 2)).toEqual([]));
  it("註冊會員第二場只見首選名", () => expect(projectCardPicks(picks, "registered", 2)).toEqual([{ nameCh: "首選" }]));
  it("Pro可見全部場次", () => expect(cardAccess("pro", 11)).toBe("full"));
  it("排位頁訪客及註冊會員只見首選排名", () => { expect(projectRacePicks(picks, "guest")).toHaveLength(1); expect(projectRacePicks(picks, "registered")).toHaveLength(1); });
  it("排位頁Pro見完整排名", () => expect(projectRacePicks(picks, "pro")).toHaveLength(2));
  it("選馬神器訪客不可見任何場次", () => expect(predictorAllowed("guest", 1)).toBe(false));
  it("選馬神器註冊會員只限第一場", () => { expect(predictorAllowed("registered", 1)).toBe(true); expect(predictorAllowed("registered", 2)).toBe(false); });
  it("百科訪客只見20行", () => expect(projectMemberRows(Array.from({ length: 30 }, (_, i) => i), "guest")).toHaveLength(20));
  it("百科會員可見全部行", () => expect(projectMemberRows(Array.from({ length: 30 }, (_, i) => i), "registered")).toHaveLength(30));
  it("對帳訪客只見最近已過賽日", () => expect(projectMeetingDates([{ date: "2026-10-25" }, { date: "2026-10-19" }, { date: "2026-10-21" }], "guest", "2026-10-23")).toEqual([{ date: "2026-10-21" }]));
  it("對帳會員保留全日目錄", () => expect(projectMeetingDates([{ date: "2026-10-19" }, { date: "2026-10-21" }], "registered", "2026-10-23")).toHaveLength(2));
  it("今日未完賽拆解需Pro", () => expect(explainTier("2026-10-23", "2026-10-23", false)).toBe("pro"));
  it("今日已完賽拆解需註冊會員", () => expect(explainTier("2026-10-23", "2026-10-23", true)).toBe("registered"));
  it("過去賽日拆解需註冊會員", () => expect(explainTier("2026-10-21", "2026-10-23", false)).toBe("registered"));
  it("功能表實際套用指定級別", () => expect(FEATURE_TIERS).toMatchObject({ "cards.race1": "guest", "cards.other_top1": "registered", "predictor.lab": "pro", "crossrace.pools": "pro", "features.table": "registered" }));
  it("開閘前會員可見全部場次", () => { const e = resolveEntitlement({ rank: 201, total: 65, gateOpenAt: null, subscription: null }); expect(cardAccess(e.hasPro ? "pro" : "registered", 11)).toBe("full"); });
  it("開閘後第201名無訂閱只見首選名", () => { const e = resolveEntitlement({ rank: 201, total: 201, gateOpenAt: "2026-10-23T00:00:00Z", foundingSlots: 200, subscription: null, now: new Date("2026-10-23T11:00:00Z") }); expect(cardAccess(e.hasPro ? "pro" : "registered", 2)).toBe("name"); });
  it("投影不改寫來源資料", () => { const before = JSON.stringify(picks); projectCardPicks(picks, "registered", 2); expect(JSON.stringify(picks)).toBe(before); });
});