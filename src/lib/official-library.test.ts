import { describe, expect, it } from "vitest";

import type { ConghuaRow, FwbRow, JtRow, OveRow } from "./official-boards";
import { readFwbRows, type OfficialEnvelope } from "./official-boards";
import {
  finishPhotoGaps,
  isOfficialSurface,
  newsPlaceLabel,
  raceListLabel,
  ratingForBrand,
  runnerMeetingFacts,
  surfaceNeedsMeeting,
  type RunnerSlot,
} from "./official-library";

function envelope(rows: unknown[]): OfficialEnvelope {
  return { available: true, rows, source: "test", date: null, venue: null, asOf: null, brand: null, season: null, section: null, pool: null, raceNo: null };
}

const slot: RunnerSlot = { raceNo: 1, horseNo: 4, brand: "K308", reserve: false };

describe("官方資料產品面", () => {
  it("只認已公開嘅板", () => {
    expect(isOfficialSurface("ratings")).toBe(true);
    expect(isOfficialSurface("photos")).toBe(true);
    expect(isOfficialSurface("blinkers")).toBe(false);
    expect(surfaceNeedsMeeting("photos")).toBe(true);
    expect(surfaceNeedsMeeting("ratings")).toBe(false);
  });

  it("消息馬場同海外賽事照收，兩邊都冇就唔出字", () => {
    expect(newsPlaceLabel("HV", null)).toBe("跑馬地");
    expect(newsPlaceLabel("ST", null)).toBe("沙田");
    expect(newsPlaceLabel(null, "s1")).toBe("海外賽事 S1");
    expect(newsPlaceLabel("HV", "S2")).toBe("跑馬地 · 海外賽事 S2");
    expect(newsPlaceLabel(null, null)).toBeNull();
    expect(newsPlaceLabel("  ", "")).toBeNull();
  });

  it("評分榜只配完全相同嘅烙號", () => {
    const rows = [
      { brand: "K308", nameCh: "電路一百", rating: 60 },
      { brand: "J062", nameCh: "嘉應高昇", rating: 145 },
    ];
    expect(ratingForBrand(rows, "k308")?.nameCh).toBe("電路一百");
    expect(ratingForBrand(rows, "K309")).toBeNull();
    expect(ratingForBrand(rows, "HK_2024_K308")).toBeNull();
    expect(ratingForBrand(rows, null)).toBeNull();
  });

  it("終點照片缺場只對住已收錄嘅場次編號", () => {
    expect(finishPhotoGaps([2, 4, 4], [1, 2, 3, 4])).toEqual({ collected: [2, 4], missing: [1, 3] });
    expect(finishPhotoGaps([2], [])).toEqual({ collected: [2], missing: [] });
    expect(finishPhotoGaps([], [1, 2])).toEqual({ collected: [], missing: [1, 2] });
    expect(raceListLabel([1, 3])).toBe("第1場、第3場");
  });

  it("賽日附屬只貼對得上嘅馬，烙號衝突或後備同號唔貼", () => {
    const ove: OveRow[] = [{
      lineNo: 1, raceNo: 1, horseNo: 4, reserve: false, horseCode: "K308", horseName: "電路一百",
      injuryDate: "2026-10-01", detail: "賽後內窺鏡檢查", passedDate: "2026-11-03", notRaceResult: true,
    }, {
      lineNo: 2, raceNo: 1, horseNo: 4, reserve: true, horseCode: "L001", horseName: "後備馬",
      injuryDate: null, detail: "後備檢查", passedDate: null, notRaceResult: true,
    }];
    const conghua: ConghuaRow[] = [{
      raceNo: 1, horseNo: 4, reserve: false, horseNameCh: "電路一百", horseNameEn: null,
      arrivedDate: "2026-11-20", returnedDate: null, notRaceResult: true,
    }];
    const jt: JtRow[] = [{
      section: "combo", raceNo: 1, horseNo: 4, reserve: false, horseName: null, importType: null, trainerName: null,
      winRate: "0.1000", placeRate: "0.2500", asOfText: "24/11/2026", notRaceResult: true,
    }];
    const fwb: FwbRow[] = [{
      raceNo: 1, horseNo: 4, reserve: false, horseNameCh: "電路一百", horseNameEn: null, brand: "J999",
      bonusCh: "不應貼上", bonusEn: null, notRaceResult: true,
    }];
    expect(runnerMeetingFacts({ ove, conghua, jt, fwb }, slot).map((fact) => fact.label)).toEqual(["獸醫檢查", "從化往來", "騎練合作"]);
    expect(runnerMeetingFacts({ ove, conghua, jt, fwb }, slot).find((fact) => fact.key === "conghua")?.text).toBe("抵埗 2026-11-20 · 返回 —");
    expect(runnerMeetingFacts({ ove, conghua, jt, fwb }, { ...slot, reserve: true, brand: "L001" }).map((fact) => fact.text)).toEqual(["後備檢查"]);
    expect(runnerMeetingFacts({ ove, conghua, jt, fwb }, { ...slot, reserve: true }).map((fact) => fact.text)).toEqual([]);
    expect(runnerMeetingFacts({ ove: [], conghua: [], jt: [], fwb: [] }, slot)).toEqual([]);
  });

  it("特別獎金只有英文都保留", () => {
    const rows = readFwbRows(envelope([{
      raceNo: 8, horseNo: 5, reserve: false, horseNameCh: "魅力奔騰", brand: "K426",
      bonusEn: "PP Bonus of HK$1.5M", bonusCh: null, notRaceResult: true,
    }]));
    expect(rows).toHaveLength(1);
    expect(runnerMeetingFacts(
      { ove: [], conghua: [], jt: [], fwb: rows },
      { raceNo: 8, horseNo: 5, brand: "K426", reserve: false },
    )[0]?.text).toBe("PP Bonus of HK$1.5M");
  });
});
