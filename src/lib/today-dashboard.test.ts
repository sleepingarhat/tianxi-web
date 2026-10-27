import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  actualTop4FromPicks,
  classDistanceLine,
  DAY_HITS_EMPTY,
  displayedRaceHit,
  distanceText,
  focusRaceHeading,
  goingPill,
  hkCalendarDate,
  isMeetingToday,
  LAB_TOOLS,
  lockPhase,
  lockStatusLabel,
  modelMarketGapPp,
  pickFocusRace,
  positiveDistance,
  PRELIMINARY_UNLOCKED_LABEL,
  RACE_DAY_NAV_LABEL,
  RACE_DAY_PAGE_TITLE,
  raceRunStatus,
  raceStartMs,
  rankedPicks,
  showPreliminaryUnlocked,
  STRATEGY_PNL_CARD_TITLE,
  STRATEGY_PNL_NOTE,
  sumVerifiedHits,
  top4HitCount,
  venueLabel,
} from "./today-dashboard";

describe("today-dashboard", () => {
  it("香港日曆日用 Asia/Hong_Kong", () => {
    expect(hkCalendarDate(new Date("2026-10-25T16:30:00Z"))).toBe("2026-10-26");
    expect(isMeetingToday("2026-10-26", new Date("2026-10-25T16:30:00Z"))).toBe(true);
    expect(isMeetingToday("2026-10-25", new Date("2026-10-25T16:30:00Z"))).toBe(false);
  });

  it("解析香港牆鐘開跑時間", () => {
    expect(raceStartMs("13:15", "2026-10-26")).toBe(Date.parse("2026-10-26T13:15:00+08:00"));
    expect(raceStartMs("bad", "2026-10-26")).toBeNull();
  });

  it("揀而家／下一場／完場後最後一場", () => {
    const races = [
      { raceNumber: 1, startTime: "13:00" },
      { raceNumber: 2, startTime: "13:30" },
      { raceNumber: 3, startTime: "14:00", settled: true },
    ];
    const before = Date.parse("2026-10-26T12:50:00+08:00");
    expect(pickFocusRace(races, "2026-10-26", before)?.kind).toBe("next");
    expect(pickFocusRace(races, "2026-10-26", before)?.race.raceNumber).toBe(1);

    const during = Date.parse("2026-10-26T13:03:00+08:00");
    expect(pickFocusRace(races, "2026-10-26", during)?.kind).toBe("current");
    expect(pickFocusRace(races, "2026-10-26", during)?.race.raceNumber).toBe(1);

    const between = Date.parse("2026-10-26T13:20:00+08:00");
    expect(pickFocusRace(races, "2026-10-26", between)?.kind).toBe("next");
    expect(pickFocusRace(races, "2026-10-26", between)?.race.raceNumber).toBe(2);

    const after = Date.parse("2026-10-26T15:00:00+08:00");
    expect(pickFocusRace(races, "2026-10-26", after)?.kind).toBe("last");
  });

  it("鎖定狀態標籤：初版／倒數／已鎖／副本／未能核實", () => {
    expect(lockPhase({ isLoading: true })).toBe("loading");
    expect(lockPhase({ publicationPending: true })).toBe("pending");
    expect(lockPhase({ edition: "unavailable" })).toBe("unavailable");
    expect(lockPhase({ frozen: true })).toBe("locked");
    const lockAt = "2026-10-26T05:10:00.000Z"; // 13:10 HKT
    const before = Date.parse("2026-10-26T04:40:00.000Z");
    expect(lockPhase({ lockAt, nowMs: before, edition: "draft" })).toBe("countdown");
    expect(lockStatusLabel("countdown", lockAt, before)).toMatch(/^T−90 倒數 00:30:/);
    expect(lockStatusLabel("locked")).toBe("已鎖");
    expect(lockStatusLabel("draft")).toBe("初版");
    expect(lockStatusLabel("pending")).toBe("正在建立凍結副本");
    expect(lockStatusLabel("unavailable")).toBe("預測暫未能核實");
  });

  it("rankedPicks 按 rank 取前五", () => {
    const picks = [
      { horseNumber: 3, rank: 3 },
      { horseNumber: 1, rank: 1 },
      { horseNumber: 2, rank: 2 },
      { horseNumber: 5, rank: 5 },
      { horseNumber: 4, rank: 4 },
      { horseNumber: 6, rank: 6 },
    ];
    expect(rankedPicks(picks, 5).map((p) => p.horseNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  it("模型 vs 市場差距以除水機率計 pp", () => {
    const field = [
      { horseNumber: 1, pWin: 0.4, winOdds: 2 },
      { horseNumber: 2, pWin: 0.3, winOdds: 4 },
      { horseNumber: 3, pWin: 0.2, winOdds: 5 },
      { horseNumber: 4, pWin: 0.1, winOdds: 10 },
    ];
    // 1/odds: 0.5 + 0.25 + 0.2 + 0.1 = 1.05；馬1 市場 = 0.5/1.05
    const gap = modelMarketGapPp(field[0], field);
    expect(gap).not.toBeNull();
    expect(gap!).toBeCloseTo((0.4 - 0.5 / 1.05) * 100, 5);
    expect(modelMarketGapPp(field[0], [{ winOdds: 2 }])).toBeNull();
  });

  it("四揀命中與 finishingPosition 推頭四", () => {
    expect(top4HitCount([{ horseNumber: 1 }, { horseNumber: 2 }, { horseNumber: 3 }, { horseNumber: 4 }], [1, 5, 3, 8])).toBe(2);
    expect(top4HitCount([{ horseNumber: 1 }], [1, 2, 3, 4])).toBeNull();
    const picks = [
      { horseNumber: 7, finishingPosition: 2 },
      { horseNumber: 1, finishingPosition: 1 },
      { horseNumber: 3, finishingPosition: 4 },
      { horseNumber: 9, finishingPosition: 3 },
      { horseNumber: 2, finishingPosition: 5 },
    ];
    expect(actualTop4FromPicks(picks)).toEqual([1, 7, 9, 3]);
  });

  it("焦點卡用賽日、開跑同馬場，唔寫死例子", () => {
    expect(focusRaceHeading({ date: "2026-10-28", startTime: "18:45", venueName: "沙田" })).toBe("28/10/26 18:45HKT 沙田馬場");
    expect(focusRaceHeading({ date: "2026-11-01", startTime: "13:00:00", venueName: "跑馬地馬場" })).toBe("01/11/26 13:00HKT 跑馬地馬場");
    expect(focusRaceHeading({ date: null, startTime: null, venueName: null })).toBe("日期待定 時間待定 馬場待定");
    expect(RACE_DAY_PAGE_TITLE).toBe("賽日");
    expect(RACE_DAY_NAV_LABEL).toBe("賽日");
  });

  it("途程有數就寫米，未有就講明待公布", () => {
    expect(positiveDistance({ distance: 1200 })).toBe(1200);
    expect(positiveDistance({ distance: null, distanceM: "1650" })).toBe(1650);
    expect(positiveDistance({ distance: null, distanceM: null })).toBeNull();
    expect(distanceText(1200)).toBe("1200米");
    expect(distanceText(null)).toBe("途程待公布");
    expect(classDistanceLine("第五班", null)).toBe("第五班 · 途程待公布");
    expect(classDistanceLine("", 1400)).toBe("班次待公布 · 1400米");
    expect(goingPill(null)).toBe("地況待公布");
    expect(goingPill("—")).toBe("地況待公布");
    expect(goingPill("好地")).toBe("地況 好地");
  });

  it("初版未鎖只標未開跑，凍結或完場唔再標", () => {
    expect(showPreliminaryUnlocked("draft", "待開")).toBe(true);
    expect(showPreliminaryUnlocked("countdown", "待開")).toBe(true);
    expect(showPreliminaryUnlocked("locked", "待開")).toBe(false);
    expect(showPreliminaryUnlocked("draft", "完場")).toBe(false);
    expect(showPreliminaryUnlocked("draft", "進行中")).toBe(false);
    expect(showPreliminaryUnlocked("pending", "待開")).toBe(false);
    expect(PRELIMINARY_UNLOCKED_LABEL).toBe("初版.未鎖");
    expect(raceRunStatus({ countdownLabel: "已開跑" })).toBe("進行中");
    expect(raceRunStatus({ hitCount: 2 })).toBe("完場");
    expect(raceRunStatus({})).toBe("待開");
  });

  it("命中逐場累計，未核實場唔入分母，被隱藏場唔顯示", () => {
    expect(displayedRaceHit({ hitRateCount: 2, verifiedHitCount: 1 })).toBe(2);
    expect(displayedRaceHit({ hitRateCount: null, verifiedHitCount: 3 })).toBe(3);
    expect(displayedRaceHit({ redactedByHitRate: true, verifiedHitCount: 3 })).toBeNull();
    expect(displayedRaceHit({})).toBeNull();
    expect(sumVerifiedHits([2, null, undefined, 1])).toEqual({ hits: 3, racesCounted: 2 });
    expect(sumVerifiedHits([null, null])).toEqual({ hits: 0, racesCounted: 0 });
    expect(DAY_HITS_EMPTY).toContain("未完場唔預估");
    expect(STRATEGY_PNL_CARD_TITLE).toBe("策略累計盈虧");
    expect(STRATEGY_PNL_NOTE).toContain("孖T／三T");
    expect(STRATEGY_PNL_NOTE).not.toContain("未含");
  });

  it("賽日頁唔再寫催促免責短句", () => {
    const page = readFileSync(new URL("../routes/today.tsx", import.meta.url), "utf8");
    const nav = readFileSync(new URL("../components/tx/AppShell.tsx", import.meta.url), "utf8");
    expect(page).not.toContain("資訊用，唔催促");
    expect(page).not.toContain("唔催促");
    expect(page).toContain("RACE_DAY_PAGE_TITLE");
    expect(nav).toContain("RACE_DAY_NAV_LABEL");
    expect(nav).not.toContain('label: "今日"');
  });

  it("venueLabel 同功能頁工具位外殼（無回測／比較器／走位／彩池）", () => {
    expect(venueLabel("ST")).toBe("沙田");
    expect(venueLabel("HV")).toBe("跑馬地");
    expect(LAB_TOOLS.map((t) => t.key)).toEqual(["h2h"]);
    expect(LAB_TOOLS[0]?.title).toBe("馬騎練數據獨立比較");
    expect(LAB_TOOLS.every((t) => t.status === "soon" || t.status === "locked")).toBe(true);
    expect(LAB_TOOLS.some((t) => t.status === "ready")).toBe(false);
    expect(LAB_TOOLS.some((t) => t.key === "going" || t.key === "backtest" || t.key === "compare" || t.key === "pace" || t.key === "pool-opt")).toBe(false);
  });
});
