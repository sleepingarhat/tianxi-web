import { describe, expect, it } from "vitest";
import { proEnforcementEnabled, projectDayPicksForViewer, raceAccess } from "./picks-projection";
import type { DayPicks } from "./racing-shapes";

// 一匹「上游完整」揀選：包括 engine.deep（因子、LGB）同 Pro 限定（value）欄位
const fullPick = (rank: number) => ({
  rank,
  horseNumber: rank,
  horseId: `H${rank}`,
  nameCh: `馬${rank}`,
  nameEn: `Horse ${rank}`,
  jockeyCh: "騎師",
  trainerCh: "練馬師",
  draw: rank,
  pWin: 0.2,
  pTop3: 0.5,
  pTop4: 0.6,
  winOdds: 5,
  pLgb: 0.21,
  lgbScore: -1.9,
  scoreSource: "lgb",
  factorBonus: 0.03,
  factorBreakdown: { draw: { bonus: 0.01, note: "x" } },
  blendProb: 0.19,
  marketRank: 2,
  value: 1.2,
  valueEdge: 0.05,
});
const fullRace = (raceNumber: number, extra: Record<string, unknown> = {}) => ({
  raceNumber,
  raceId: `R${raceNumber}`,
  title: `第${raceNumber}場`,
  startTime: "13:00",
  distance: 1200,
  going: "好地",
  class: "第四班",
  scoreSource: "lgb",
  lgbModelVersion: "v9",
  lgbCoverage: { applied: true, rows: 12 },
  ensembleAlpha: 0.7,
  expectedBoxCoverage: { trio_n4: 0.3 },
  raceQuality: { tier: "A", rank: 1, total: 9 },
  picks: [fullPick(1), fullPick(2), fullPick(3), fullPick(4)],
  ...extra,
});
const day = {
  date: "2026-10-25",
  venue: "ST",
  generatedAt: "2026-10-25T00:00:00Z",
  scoreSource: "lgb",
  engine: {
    lockAt: "2026-10-25T04:00:00Z",
    lgbModelVersion: "v9",
    eloEngine: "v12",
    computeMs: 10,
  },
  meta: { lockAt: "2026-10-25T04:00:00Z", lgbModelVersion: "v9" },
  races: [fullRace(1), fullRace(2, { settled: true, hasResult: true }), fullRace(3)],
} as unknown as DayPicks;
const snapshot = JSON.stringify(day);

const DEEP_PICK = [
  "pLgb",
  "lgbScore",
  "scoreSource",
  "factorBonus",
  "factorBreakdown",
  "blendProb",
  "marketRank",
];
const PRO_PICK = ["value", "valueEdge"];
const MODEL_RACE = ["lgbModelVersion", "lgbCoverage", "ensembleAlpha"];
const keys = (o: unknown) => Object.keys(o as object).sort();
const META_KEYS = [
  "class",
  "distance",
  "going",
  "picks",
  "raceId",
  "raceNumber",
  "startTime",
  "title",
].sort();

describe("全日預測伺服器投影（PRO_ENFORCEMENT）", () => {
  it("預設關閉", () => {
    expect(proEnforcementEnabled({})).toBe(false);
    expect(proEnforcementEnabled({ PRO_ENFORCEMENT: "off" })).toBe(false);
    expect(proEnforcementEnabled({ PRO_ENFORCEMENT: "on" })).toBe(true);
  });

  it("存取矩陣跟 FEATURE_TIERS", () => {
    const [r1, done, other] = day.races!;
    expect([
      raceAccess("guest", r1!),
      raceAccess("guest", done!),
      raceAccess("guest", other!),
    ]).toEqual(["full", "locked", "locked"]);
    expect([
      raceAccess("registered", r1!),
      raceAccess("registered", done!),
      raceAccess("registered", other!),
    ]).toEqual(["full", "full", "top1"]);
    expect([raceAccess("pro", r1!), raceAccess("pro", done!), raceAccess("pro", other!)]).toEqual([
      "full",
      "full",
      "full",
    ]);
  });

  describe("訪客（guest）", () => {
    const out = projectDayPicksForViewer(day, "guest");
    const [r1, done, other] = out.races!;
    it("全日層面：剝走 engine.deep，只留 lockAt", () => {
      expect(out.engine).toEqual({ lockAt: "2026-10-25T04:00:00Z" });
      expect(out).not.toHaveProperty("meta");
      expect(out).not.toHaveProperty("scoreSource");
      expect(out.date).toBe("2026-10-25");
    });
    it("第一場：全部揀選，但冇 engine.deep／Pro 欄位、冇模型版本", () => {
      expect(r1!.picks).toHaveLength(4);
      for (const p of r1!.picks!)
        for (const k of [...DEEP_PICK, ...PRO_PICK]) expect(p).not.toHaveProperty(k);
      expect(keys(r1!.picks![0])).toEqual(
        [
          "draw",
          "horseId",
          "horseNumber",
          "jockeyCh",
          "nameCh",
          "nameEn",
          "pTop3",
          "pTop4",
          "pWin",
          "rank",
          "trainerCh",
          "winOdds",
        ].sort(),
      );
      for (const k of MODEL_RACE) expect(r1).not.toHaveProperty(k);
      expect(r1).toHaveProperty("raceQuality");
    });
    it("已完賽場次：冇揀選，只得排位資料", () => {
      expect(done!.picks).toEqual([]);
      expect(keys(done)).toEqual([...META_KEYS, "hasResult", "settled"].sort());
    });
    it("其他場次：冇揀選（連首選都冇），只得排位資料", () => {
      expect(other!.picks).toEqual([]);
      expect(keys(other)).toEqual(META_KEYS);
    });
  });

  describe("登入免費會員（registered）", () => {
    const out = projectDayPicksForViewer(day, "registered");
    const [r1, done, other] = out.races!;
    it("全日層面：engine.deep 保留", () => {
      expect(out.engine).toEqual(day.engine);
      expect(out.meta).toEqual(day.meta);
    });
    it("第一場：全部揀選連 engine.deep，但冇 Pro 限定 value", () => {
      expect(r1!.picks).toHaveLength(4);
      for (const p of r1!.picks!) {
        for (const k of DEEP_PICK) expect(p).toHaveProperty(k);
        for (const k of PRO_PICK) expect(p).not.toHaveProperty(k);
      }
      for (const k of MODEL_RACE) expect(r1).toHaveProperty(k);
    });
    it("已完賽場次：全部揀選（explain.postrace／reconcile.full），冇 value", () => {
      expect(done!.picks).toHaveLength(4);
      for (const p of done!.picks!) for (const k of PRO_PICK) expect(p).not.toHaveProperty(k);
    });
    it("其他場次：只得首選一匹嘅馬號／名，冇概率、冇模型欄位", () => {
      expect(other!.picks).toEqual([
        { rank: 1, horseNumber: 1, horseId: "H1", nameCh: "馬1", nameEn: "Horse 1" },
      ]);
      expect(keys(other)).toEqual(META_KEYS);
    });
  });

  describe("Pro", () => {
    it("原封不動（全部場次、全部欄位）", () => {
      const out = projectDayPicksForViewer(day, "pro");
      expect(out).toBe(day);
      for (const r of out.races!) expect(r.picks).toHaveLength(4);
      expect(out.races![2]!.picks![0]).toHaveProperty("valueEdge");
    });
  });

  it("唔改原物件（快取共用安全）", () => {
    projectDayPicksForViewer(day, "guest");
    projectDayPicksForViewer(day, "registered");
    expect(JSON.stringify(day)).toBe(snapshot);
  });

  it("首選按 rank 揀，唔靠陣列次序", () => {
    const shuffled = {
      races: [{ raceNumber: 5, picks: [fullPick(3), fullPick(1), fullPick(2)] }],
    } as unknown as DayPicks;
    expect(projectDayPicksForViewer(shuffled, "registered").races![0]!.picks![0]!.rank).toBe(1);
  });
});
