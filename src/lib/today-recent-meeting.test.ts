import { describe, expect, it } from "vitest";
import { isRecentPastMeeting } from "./today-dashboard";

describe("完賽賽日保留展示 1–2 日", () => {
  const now = new Date("2026-10-28T19:57:00Z"); // HKT 10-29 03:57
  it("昨日賽事保留", () => expect(isRecentPastMeeting("2026-10-28", now)).toBe(true));
  it("兩日前仍保留", () => expect(isRecentPastMeeting("2026-10-27", now)).toBe(true));
  it("三日前不再保留", () => expect(isRecentPastMeeting("2026-10-26", now)).toBe(false));
  it("今日及未來不算", () => {
    expect(isRecentPastMeeting("2026-10-29", now)).toBe(false);
    expect(isRecentPastMeeting("2026-11-01", now)).toBe(false);
  });
});

import { raceRunStatus } from "./today-dashboard";
describe("保留展示期間場次狀態", () => {
  it("上一賽日已開跑但未核實賽果，都標完場而唔係進行中", () => {
    expect(raceRunStatus({ countdownLabel: "已開跑", meetingPast: true })).toBe("完場");
  });
  it("當日賽事開跑未有賽果仍係進行中", () => {
    expect(raceRunStatus({ countdownLabel: "已開跑" })).toBe("進行中");
  });
});
