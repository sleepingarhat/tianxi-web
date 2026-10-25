import { describe, expect, it } from "vitest";
import {
  copyAllowed,
  DAY_SPEC,
  lockedEvidenceAllowed,
  projectLockedEvidence,
  FACTOR_KEYS,
  proEnforcementEnabled,
  projectDayPicksForViewer,
  raceAccess,
} from "./picks-projection";
import type { DayPicks, RaceRow } from "./racing-shapes";

/** 深層鍵集合：物件用 a.b、陣列元素用 a[]（陣列內所有元素合併）。 */
function deepKeys(value: unknown, prefix = ""): string[] {
  const out = new Set<string>();
  const walk = (v: unknown, p: string) => {
    if (Array.isArray(v)) {
      for (const item of v) walk(item, `${p}[]`);
      return;
    }
    if (v && typeof v === "object") {
      for (const [k, child] of Object.entries(v)) {
        const path = p ? `${p}.${k}` : k;
        out.add(path);
        walk(child, path);
      }
    }
  };
  walk(value, prefix);
  return [...out].sort();
}
const under = (keys: string[], prefix: string) =>
  keys.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)).sort();

const SECRET = "__secret__";
const officialChange = () => ({
  raceNumber: 1, horseNumber: 1, kind: "scratched", text: "退出競賽", replacement: null,
  announcedAt: "25/10 09:00", announcedAtIso: "2026-10-25T01:00:00Z", beforeLock: true,
  [SECRET]: "leak",
});
const factorBreakdown = () =>
  Object.fromEntries([
    ...FACTOR_KEYS.map((k) => [k, { bonus: 0.01, conf: 1, note: "x", [SECRET]: "leak" }]),
    [SECRET, { bonus: 9 }],
  ]);

// 上游完整揀選：所有已知欄位 + 每層都有一個「未知新欄位」
const fullPick = (rank: number) => ({
  rank, horseNumber: rank, horseId: `horse_H${rank}`, nameCh: `馬${rank}`, nameEn: `Horse ${rank}`,
  jockeyCh: "騎師", trainerCh: "練馬師", draw: rank, declaredWeight: 1100, weight: 126, rating: 60,
  code: "A001", gear: "B", pWin: 0.2, pTop3: 0.5, pTop4: 0.6, winOdds: 5, liveWinOdds: 4.8,
  frozen: true, finishingPosition: null, generatedAt: "2026-10-25T00:00:00Z",
  officialChange: officialChange(),
  scoreSource: "lgb", pLgb: 0.21, lgbScore: -1.9, lgbModelVersion: "v9", modelVersion: "v9",
  ensembleAlpha: 0.7, finalScore: 1520, horseElo: 1500, jockeyElo: 1510, trainerElo: 1490,
  eloComposite: 1501, eloEngine: "v12",
  factorBonus: 0.03, factorBreakdown: factorBreakdown(),
  marketProb: 0.18, marketRank: 2, blendProb: 0.19, value: 1.2, valueEdge: 0.05,
  [SECRET]: "leak", horseConfidence: 0.9, eloSource: "snapshot",
  // 已知葉欄位被上游改成物件：唔可以抄
  nameCh_obj: { x: 1 },
});
const fullRace = (raceNumber: number, extra: Record<string, unknown> = {}) => ({
  raceNumber, raceId: `race_2026-10-25_ST_${raceNumber}`, title: `第${raceNumber}場`, startTime: "13:00",
  distance: 1200, distanceM: 1200, className: "第四班", class: "4", going: "好地", course: "A", track: "草地",
  officialChange: officialChange(),
  scoreSource: "lgb", marketReady: true, oddsSnapshotAt: "2026-10-25T03:00:00Z",
  raceQuality: { rank: 1, total: 9, tier: "高", metric: "trio_n4", score: 0.3, [SECRET]: 1 },
  expectedBoxCoverage: { trio_n4: 0.3, trio_n5: 0.4, trio_n6: 0.5, first4_n4: 0.1, first4_n5: 0.2, first4_n6: 0.3, [SECRET]: 1 },
  lgbModelVersion: "v9", ensembleAlpha: 0.7, probabilityModel: "harville-v1", marketBeta: 0.3,
  lgbCoverage: { applied: true, rows: 12, hits: 12, [SECRET]: 1 },
  lgbLookupRaceId: "internal", [SECRET]: "leak",
  picks: [fullPick(2), fullPick(1), fullPick(3), fullPick(4)],
  ...extra,
});
const engine = () => ({
  lockAt: "2026-10-25T04:00:00Z", eloEngine: "v12", eloReady: true, lgbModelVersion: "v9", computeMs: 10,
  eloWeights: { horse: 0.5, jockey: 0.3, trainer: 0.2, [SECRET]: 1 },
  lgbCoverage: { rows: 12, [SECRET]: 1 }, probabilityEvidence: { pTop4: "saved", [SECRET]: 1 },
  [SECRET]: "leak",
});
const day = {
  date: "2026-10-25", venue: "ST", trackCondition: "好地", generatedAt: "2026-10-25T00:00:00Z",
  lockAt: "2026-10-25T04:00:00Z", frozen: false, edition: "draft", publicationDeadline: "2026-10-25T04:00:00Z",
  noMeeting: false, message: "ok", eloReady: true,
  scoreSource: "lgb", eloEngine: "v12", lgbModelVersion: "v9", computeMs: 10,
  eloWeights: { horse: 0.5, jockey: 0.3, trainer: 0.2 }, lgbCoverage: { rows: 12 },
  seedSummary: { ratingSeeded: 1, classSeeded: 2, totalSeeded: 3, [SECRET]: 1 },
  probabilityEvidence: { pTop4: "saved" },
  engine: engine(), meta: engine(),
  predictionLog: { rows: 100 }, probCalibration: { version: 1 }, [SECRET]: "leak",
  races: [fullRace(1), fullRace(2, { settled: true, hasResult: true }), fullRace(3)],
} as unknown as DayPicks;
const snapshot = JSON.stringify(day);

/* ---------- 預期鍵集合（由 FEATURE_TIERS 對照表寫死，任何改動都要改測試） ---------- */
const OC = ["officialChange", ...["raceNumber", "horseNumber", "kind", "text", "replacement", "announcedAt", "announcedAtIso", "beforeLock"].map((k) => `officialChange.${k}`)];
const PICK_TOP1 = ["rank", "horseNumber", "horseId", "nameCh", "nameEn"];
const PICK_CARD = [
  ...PICK_TOP1, "jockeyCh", "trainerCh", "draw", "declaredWeight", "weight", "rating", "code", "gear",
  "pWin", "pTop3", "pTop4", "winOdds", "liveWinOdds", "frozen", "finishingPosition", "generatedAt", ...OC,
];
const PICK_DEEP = ["scoreSource", "pLgb", "lgbScore", "lgbModelVersion", "modelVersion", "ensembleAlpha", "finalScore", "horseElo", "jockeyElo", "trainerElo", "eloComposite", "eloEngine"];
const PICK_EXPLAIN = ["factorBonus", "factorBreakdown", ...FACTOR_KEYS.flatMap((k) => [`factorBreakdown.${k}`, ...["bonus", "conf", "note"].map((f) => `factorBreakdown.${k}.${f}`)])];
const PICK_VALUE = ["marketProb", "marketRank", "blendProb", "value", "valueEdge"];
const RACE_META = ["raceNumber", "raceId", "title", "startTime", "distance", "distanceM", "className", "class", "going", "course", "track", ...OC];
const RACE_CARD = [
  ...RACE_META, "scoreSource", "marketReady", "oddsSnapshotAt",
  "raceQuality", ...["rank", "total", "tier", "metric", "score"].map((k) => `raceQuality.${k}`),
  "expectedBoxCoverage", ...["trio_n4", "trio_n5", "trio_n6", "first4_n4", "first4_n5", "first4_n6"].map((k) => `expectedBoxCoverage.${k}`),
];
const RACE_DEEP = ["lgbModelVersion", "ensembleAlpha", "probabilityModel", "marketBeta", "lgbCoverage", "lgbCoverage.applied", "lgbCoverage.rows", "lgbCoverage.hits"];
const FINISHED = ["settled", "hasResult"];
const sorted = (...lists: string[][]) => [...new Set(lists.flat())].sort();
const picksPaths = (pickKeys: string[]) => ["picks", ...pickKeys.map((k) => `picks[].${k}`)];

const ENGINE_GUEST = ["lockAt"];
const ENGINE_DEEP = ["lockAt", "eloEngine", "eloReady", "lgbModelVersion", "computeMs", "eloWeights", "eloWeights.horse", "eloWeights.jockey", "eloWeights.trainer", "lgbCoverage", "lgbCoverage.rows", "probabilityEvidence", "probabilityEvidence.pTop4"];
const DAY_CARD = ["date", "venue", "trackCondition", "generatedAt", "lockAt", "frozen", "edition", "publicationDeadline", "noMeeting", "message", "eloReady"];
const DAY_DEEP = ["scoreSource", "eloEngine", "lgbModelVersion", "computeMs", "eloWeights", "eloWeights.horse", "eloWeights.jockey", "eloWeights.trainer", "lgbCoverage", "lgbCoverage.rows", "seedSummary", "seedSummary.ratingSeeded", "seedSummary.classSeeded", "seedSummary.totalSeeded", "probabilityEvidence", "probabilityEvidence.pTop4"];

const dayLevel = (out: DayPicks) => deepKeys({ ...out, races: undefined }).filter((k) => k !== "races");
const raceKeys = (out: DayPicks, i: number) => deepKeys(out.races![i]);

describe("全日預測伺服器投影（PRO_ENFORCEMENT）", () => {
  it("預設關閉", () => {
    expect(proEnforcementEnabled({})).toBe(false);
    expect(proEnforcementEnabled({ PRO_ENFORCEMENT: "off" })).toBe(false);
    expect(proEnforcementEnabled({ PRO_ENFORCEMENT: "on" })).toBe(true);
  });

  it("存取矩陣跟 FEATURE_TIERS", () => {
    const [r1, done, other] = day.races! as RaceRow[];
    expect(["guest", "registered", "pro"].map((t) => [r1, done, other].map((r) => raceAccess(t as "guest", r!)))).toEqual([
      ["full", "locked", "locked"],
      ["full", "full", "top1"],
      ["full", "full", "full"],
    ]);
  });

  describe("訪客（guest）：深層鍵集合完全相等", () => {
    const out = projectDayPicksForViewer(day, "guest");
    it("全日層面", () => expect(dayLevel(out)).toEqual(sorted(DAY_CARD, ["engine", "meta"], ENGINE_GUEST.map((k) => `engine.${k}`), ENGINE_GUEST.map((k) => `meta.${k}`))));
    it("第一場：只得 card 欄位", () => expect(raceKeys(out, 0)).toEqual(sorted(RACE_CARD, picksPaths(PICK_CARD))));
    it("已完賽場次：只得排位資料", () => {
      expect(raceKeys(out, 1)).toEqual(sorted(RACE_META, FINISHED, ["picks"]));
      expect(out.races![1]!.picks).toEqual([]);
    });
    it("其他場次：只得排位資料", () => {
      expect(raceKeys(out, 2)).toEqual(sorted(RACE_META, ["picks"]));
      expect(out.races![2]!.picks).toEqual([]);
    });
  });

  describe("免費會員（registered）：深層鍵集合完全相等", () => {
    const out = projectDayPicksForViewer(day, "registered");
    it("全日層面：engine.deep", () => expect(dayLevel(out)).toEqual(sorted(DAY_CARD, DAY_DEEP, ["engine", "meta"], ENGINE_DEEP.map((k) => `engine.${k}`), ENGINE_DEEP.map((k) => `meta.${k}`))));
    it("第一場（未完賽）：card + engine.deep；冇 explain.prerace（pro）、冇 poolodds.value（pro）", () =>
      expect(raceKeys(out, 0)).toEqual(sorted(RACE_CARD, RACE_DEEP, picksPaths([...PICK_CARD, ...PICK_DEEP]))));
    it("已完賽場次：card + engine.deep + explain.postrace；冇 poolodds.value", () =>
      expect(raceKeys(out, 1)).toEqual(sorted(RACE_CARD, RACE_DEEP, FINISHED, picksPaths([...PICK_CARD, ...PICK_DEEP, ...PICK_EXPLAIN]))));
    it("其他場次：排位資料 + 首選一匹身份", () => {
      expect(raceKeys(out, 2)).toEqual(sorted(RACE_META, picksPaths(PICK_TOP1)));
      expect(out.races![2]!.picks).toEqual([{ rank: 1, horseNumber: 1, horseId: "horse_H1", nameCh: "馬1", nameEn: "Horse 1" }]);
    });
  });

  describe("Pro：都係允許清單（閘門全開），唔係原物件", () => {
    const out = projectDayPicksForViewer(day, "pro");
    it("唔係原物件", () => expect(out).not.toBe(day));
    it("全日層面", () => expect(dayLevel(out)).toEqual(sorted(DAY_CARD, DAY_DEEP, ["engine", "meta"], ENGINE_DEEP.map((k) => `engine.${k}`), ENGINE_DEEP.map((k) => `meta.${k}`))));
    const all = [...PICK_CARD, ...PICK_DEEP, ...PICK_EXPLAIN, ...PICK_VALUE];
    it("每場都完整", () => {
      expect(raceKeys(out, 0)).toEqual(sorted(RACE_CARD, RACE_DEEP, picksPaths(all)));
      expect(raceKeys(out, 1)).toEqual(sorted(RACE_CARD, RACE_DEEP, FINISHED, picksPaths(all)));
      expect(raceKeys(out, 2)).toEqual(sorted(RACE_CARD, RACE_DEEP, picksPaths(all)));
      for (const r of out.races!) expect(r.picks).toHaveLength(4);
    });
  });

  describe("上游新增未知欄位唔會洩漏", () => {
    for (const tier of ["guest", "registered", "pro"] as const) {
      it(`${tier}：任何深度都冇 ${SECRET}／內部欄位`, () => {
        const json = JSON.stringify(projectDayPicksForViewer(day, tier));
        for (const k of [SECRET, "lgbLookupRaceId", "predictionLog", "probCalibration", "horseConfidence", "eloSource", "nameCh_obj"])
          expect(json).not.toContain(k);
      });
    }
    it("葉欄位被換成物件／陣列都唔抄", () => {
      const out = copyAllowed({ date: { secret: 1 }, venue: ["x"], message: "ok" }, DAY_SPEC, { tier: "pro", finished: false });
      expect(out).toEqual({ message: "ok" });
    });
    it("新加一個全新頂層／場次／揀選欄位，訪客同免費會員鍵集合不變", () => {
      const mutated = JSON.parse(snapshot) as Record<string, any>;
      mutated["newTopField"] = { a: 1 };
      for (const r of mutated["races"]) {
        r.newRaceField = 1;
        r.raceQuality.newNested = 1;
        for (const p of r.picks) { p.newPickField = 2; p.officialChange.newNested = 3; p.factorBreakdown.draw.newNested = 4; }
      }
      for (const tier of ["guest", "registered"] as const)
        expect(deepKeys(projectDayPicksForViewer(mutated as DayPicks, tier))).toEqual(deepKeys(projectDayPicksForViewer(day, tier)));
    });
  });

  it("唔改原物件（快取共用安全）", () => {
    for (const t of ["guest", "registered", "pro"] as const) projectDayPicksForViewer(day, t);
    expect(JSON.stringify(day)).toBe(snapshot);
  });

  it("首選按 rank 揀，唔靠陣列次序", () => {
    const shuffled = { races: [{ raceNumber: 5, picks: [fullPick(3), fullPick(1), fullPick(2)] }] } as unknown as DayPicks;
    expect(projectDayPicksForViewer(shuffled, "registered").races![0]!.picks![0]!.rank).toBe(1);
  });

  it("壞輸入唔會爆", () => {
    expect(projectDayPicksForViewer(null as unknown as DayPicks, "guest")).toEqual({ races: [] });
    expect(projectDayPicksForViewer({ races: [null, 1, { raceNumber: 1 }] } as unknown as DayPicks, "guest").races).toEqual([{ raceNumber: 1, picks: [] }]);
  });
});

describe("單匹鎖定解釋（getLockedEvidence）", () => {
  it("賽後 explain.postrace=registered；賽前 explain.prerace=pro", () => {
    expect([lockedEvidenceAllowed("guest", true), lockedEvidenceAllowed("registered", true), lockedEvidenceAllowed("pro", true)]).toEqual([false, true, true]);
    expect([lockedEvidenceAllowed("guest", false), lockedEvidenceAllowed("registered", false), lockedEvidenceAllowed("pro", false)]).toEqual([false, false, true]);
  });
  it("只抄允許清單葉欄位，未知欄位／物件唔抄", () => {
    const row = { horseElo: 1500, finalScore: 1, provenance: "historical-unverified", sire: "S", [SECRET]: "leak", source: { nested: 1 } };
    expect(projectLockedEvidence(row, "registered")).toEqual({ horseElo: 1500, finalScore: 1, provenance: "historical-unverified", sire: "S" });
  });
});
