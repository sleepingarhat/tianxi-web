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
      cardHorseNo: null, cardReserve: null, cardHorseId: null, cardBrand: null, alignedBy: null,
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
    expect(rows[0]).toMatchObject({ cardHorseNo: null, cardReserve: null, cardBrand: null, alignedBy: null });
    expect(runnerMeetingFacts(
      { ove: [], conghua: [], jt: [], fwb: rows },
      { raceNo: 8, horseNo: 5, brand: "K426", reserve: false },
    )[0]?.text).toBe("PP Bonus of HK$1.5M");
  });

  it("特別獎金跟排位烙號，唔跟名單馬號", () => {
    const blank = { ove: [] as OveRow[], conghua: [] as ConghuaRow[], jt: [] as JtRow[] };
    const rows = readFwbRows(envelope([
      {
        raceNo: 10, horseNo: 1, reserve: true, horseNameCh: "風耀奪標", brand: "L435",
        bonusCh: "L435 獎金", notRaceResult: true,
        cardHorseNo: 1, cardReserve: true, cardHorseId: "HK_2025_L435", cardBrand: "L435", alignedBy: "brand",
      },
      {
        raceNo: 11, horseNo: 3, reserve: false, horseNameCh: "賀長勝", brand: "L529",
        bonusCh: "L529 獎金", notRaceResult: true,
        cardHorseNo: 3, cardReserve: false, cardHorseId: "HK_2025_L529", cardBrand: "L529", alignedBy: "brand",
      },
      {
        raceNo: 8, horseNo: 2, reserve: true, horseNameCh: "日光明照", brand: "M109",
        bonusCh: "M109 獎金", notRaceResult: true,
        cardHorseNo: 2, cardReserve: true, cardHorseId: "HK_2026_M109", cardBrand: "M109", alignedBy: "brand",
      },
      {
        raceNo: 8, horseNo: 1, reserve: true, horseNameCh: "天時威威", brand: "M021",
        bonusCh: "M021 獎金", notRaceResult: true,
        cardHorseNo: 11, cardReserve: false, cardHorseId: "HK_2025_M021", cardBrand: "M021", alignedBy: "brand",
      },
    ]));
    expect(rows.find((row) => row.brand === "L435")).toMatchObject({ horseNo: 1, reserve: true });
    expect(rows.find((row) => row.brand === "M021")).toMatchObject({ horseNo: 1, reserve: true, cardHorseNo: 11, cardReserve: false });

    const facts = (slot: RunnerSlot) => runnerMeetingFacts({ ...blank, fwb: rows }, slot).map((fact) => fact.text);

    expect(facts({ raceNo: 10, horseNo: 1, brand: "L152", reserve: false })).toEqual([]);
    expect(facts({ raceNo: 10, horseNo: 1, brand: "L435", horseId: "HK_2025_L435", reserve: true })).toEqual(["L435 獎金"]);
    expect(facts({ raceNo: 11, horseNo: 3, brand: "L529", reserve: false })).toEqual(["L529 獎金"]);
    expect(facts({ raceNo: 11, horseNo: 1, brand: "J100", reserve: true })).toEqual([]);
    expect(facts({ raceNo: 11, horseNo: 1, brand: "L529", reserve: true })).toEqual(["L529 獎金"]);
    expect(facts({ raceNo: 8, horseNo: 2, brand: "M070", reserve: false })).toEqual([]);
    expect(facts({ raceNo: 8, horseNo: 2, brand: "M109", reserve: true })).toEqual(["M109 獎金"]);
    expect(facts({ raceNo: 8, horseNo: 11, brand: "M021", reserve: false })).toEqual(["M021 獎金"]);
    expect(facts({ raceNo: 8, horseNo: 1, brand: "J290", reserve: false })).toEqual([]);
    expect(facts({ raceNo: 8, horseNo: 1, brand: "H001", reserve: true })).toEqual([]);
    expect(facts({ raceNo: 8, horseNo: 1, brand: null, reserve: true })).toEqual([]);
    expect(facts({ raceNo: 8, horseNo: 1, brand: null, reserve: false })).toEqual([]);
    expect(facts({ raceNo: 8, horseNo: 11, brand: null, reserve: false })).toEqual(["M021 獎金"]);
    expect(facts({ raceNo: 8, horseNo: 11, brand: null, horseId: "horse_M021", reserve: false })).toEqual(["M021 獎金"]);
  });

  it("特別獎金可以由馬匹編號對上，名單馬號唔使一樣", () => {
    const rows = readFwbRows(envelope([{
      raceNo: 8, horseNo: 1, reserve: true, horseNameCh: "天時威威", brand: "M021",
      bonusCh: "編號獎金", notRaceResult: true,
      cardHorseNo: 11, cardReserve: false, cardHorseId: "HK_2025_M021", alignedBy: "horse_id",
    }]));
    const input = { ove: [], conghua: [], jt: [], fwb: rows };
    expect(rows[0]).toMatchObject({ horseNo: 1, reserve: true, cardBrand: null, alignedBy: "horse_id" });
    expect(runnerMeetingFacts(input, { raceNo: 8, horseNo: 11, brand: null, horseId: "HK_2025_M021", reserve: false }).map((fact) => fact.text)).toEqual(["編號獎金"]);
    expect(runnerMeetingFacts(input, { raceNo: 8, horseNo: 1, brand: "J290", reserve: false })).toEqual([]);
    expect(runnerMeetingFacts(input, { raceNo: 8, horseNo: 1, brand: null, reserve: true })).toEqual([]);
  });

  it("未對上排位時，後備名單唔會貼去同號正選", () => {
    const row: FwbRow = {
      raceNo: 10, horseNo: 1, reserve: true, horseNameCh: "風耀奪標", horseNameEn: null, brand: "L435",
      bonusCh: "名單獎金", bonusEn: null, notRaceResult: true,
      cardHorseNo: null, cardReserve: null, cardHorseId: null, cardBrand: null, alignedBy: null,
    };
    const input = { ove: [], conghua: [], jt: [], fwb: [row] };
    expect(runnerMeetingFacts(input, { raceNo: 10, horseNo: 1, brand: "L152", reserve: false })).toEqual([]);
    expect(runnerMeetingFacts(input, { raceNo: 10, horseNo: 1, brand: null, reserve: false })).toEqual([]);
    expect(runnerMeetingFacts(input, { raceNo: 10, horseNo: 1, brand: "L435", reserve: true }).map((fact) => fact.text)).toEqual(["名單獎金"]);
    expect(runnerMeetingFacts(input, { raceNo: 10, horseNo: 1, brand: "H001", reserve: true })).toEqual([]);
  });
});
