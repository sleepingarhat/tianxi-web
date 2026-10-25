// getTodayPicksAll 伺服器投影回歸：唔再依賴 PRO_ENFORCEMENT，一律按 viewerTier() + FEATURE_TIERS 投影。
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ day: vi.fn(), tier: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: (v: (i: unknown) => unknown) => { (builder as any).v = v; return builder; }, handler: (h: (a: { data: unknown; context?: unknown }) => unknown) => (input: { data: unknown; context?: unknown }) => h({ data: (builder as any).v ? (builder as any).v(input.data) : input.data, context: input.context }) };
  return builder;
} }));
vi.mock("@tanstack/react-start/server", () => ({ setResponseHeader: vi.fn() }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("./picks-refresh", () => ({ createPicksRefresh: () => () => mocks.day() }));
vi.mock("./picks-entitlement.server", () => ({ viewerTier: () => mocks.tier() }));

import { getTodayPicksAll } from "./picks.functions";
import type { DayPicks } from "./racing-shapes";

const pick = (rank: number) => ({
  rank, horseNumber: rank, horseId: `horse_H${rank}`, nameCh: `馬${rank}`, nameEn: `Horse ${rank}`,
  jockeyCh: "騎師", trainerCh: "練馬師", draw: rank, weight: 126, rating: 60,
  pWin: 0.2, pTop3: 0.5, pTop4: 0.6, winOdds: 5,
  scoreSource: "lgb", finalScore: 1520, horseElo: 1500,
  factorBonus: 0.03, marketProb: 0.18, value: 1.2,
});
const race = (n: number, finished = false) => ({
  raceNumber: n, raceId: `race_2026-10-25_ST_${n}`, title: `第${n}場`, startTime: "13:00",
  distance: 1200, distanceM: 1200, className: "第四班", going: "好地",
  ...(finished ? { settled: true, hasResult: true } : {}),
  picks: [pick(1), pick(2), pick(3), pick(4)],
});
// 第1場未完賽、第2場已完賽、第3場未完賽
const day = {
  date: "2026-10-25", venue: "ST", lockAt: "2026-10-25T04:00:00Z", frozen: false, edition: "draft",
  races: [race(1), race(2, true), race(3)],
} as unknown as DayPicks;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.day.mockResolvedValue(structuredClone(day));
});

describe("getTodayPicksAll 伺服器投影", () => {
  it("匿名：第1場完整，已完賽第2場只得排位，未完賽第3場冇預測", async () => {
    mocks.tier.mockResolvedValue("guest");
    const out = await (getTodayPicksAll as any)({ data: undefined });
    expect(out.races).toHaveLength(3);
    expect(out.races[0].picks).toHaveLength(4);
    expect(out.races[1].picks).toEqual([]);
    expect(out.races[2].picks).toEqual([]);
    expect(JSON.stringify(out.races[2])).not.toContain("pWin");
  });

  it("已註冊：第1場完整，已完賽第2場完整，未完賽第3場只得首選身份（冇機率）", async () => {
    mocks.tier.mockResolvedValue("registered");
    const out = await (getTodayPicksAll as any)({ data: undefined });
    expect(out.races[0].picks).toHaveLength(4);
    expect(out.races[1].picks).toHaveLength(4);
    expect(out.races[2].picks).toHaveLength(1);
    expect(out.races[2].picks[0]).toEqual({ rank: 1, horseNumber: 1, horseId: "horse_H1", nameCh: "馬1", nameEn: "Horse 1" });
  });

  it("Pro：全部場次完整（但都係允許清單投影，唔係原物件）", async () => {
    mocks.tier.mockResolvedValue("pro");
    const out = await (getTodayPicksAll as any)({ data: undefined });
    for (const r of out.races) expect(r.picks).toHaveLength(4);
    expect(out.races[2].picks[0].pWin).toBe(0.2);
    expect(out).not.toBe(day);
  });

  it("PRO_ENFORCEMENT 無論點設都一律投影（開關已廢除）", async () => {
    vi.stubEnv("PRO_ENFORCEMENT", "off");
    mocks.tier.mockResolvedValue("guest");
    const out = await (getTodayPicksAll as any)({ data: undefined });
    expect(out.races[2].picks).toEqual([]);
    vi.unstubAllEnvs();
  });
});
