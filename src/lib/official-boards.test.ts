import { describe, expect, it } from "vitest";

import {
  asLocalBrand,
  challengeRaceLabel,
  emptyBoardLabel,
  filterRows,
  finishPhotoUrl,
  formatOfficialRate,
  groupChallenge,
  officialBoardPath,
  officialScopeOf,
  pageOf,
  readChallengeRows,
  readEnvelope,
  readFinishPhotos,
  readFormerNames,
  readFwbRows,
  readJtRows,
  readOveRows,
  readSpecialIndex,
  type OfficialEnvelope,
} from "./official-boards";

function envelope(rows: unknown[], available = true): OfficialEnvelope {
  return {
    available,
    rows,
    source: "test",
    date: null,
    venue: null,
    asOf: null,
    brand: null,
    season: null,
    section: null,
    pool: null,
    raceNo: null,
  };
}

describe("官方資料路徑", () => {
  it("賽日板必須有日期同馬場，唔啱就唔發請求", () => {
    expect(officialBoardPath("ove-record", { date: "2026-11-11", venue: "HV" })).toBe("/api/official/ove-record?date=2026-11-11&venue=HV");
    expect(officialBoardPath("conghua-movement", { date: "2026-11-11", venue: "HV" })).toBe("/api/official/conghua-movement?date=2026-11-11&venue=HV");
    expect(officialBoardPath("fwb-declared", { date: "2026-11-11", venue: "HV" })).toBe("/api/official/fwb-declared?date=2026-11-11&venue=HV");
    expect(officialBoardPath("ove-record", { date: "2026-11-11" })).toBeNull();
    expect(officialBoardPath("ove-record", { date: "2026-13-40", venue: "XX" })).toBeNull();
    expect(officialBoardPath("ove-record", {})).toBeNull();
  });

  it("騎練、終點照片同挑戰賠率只附合法篩選", () => {
    expect(officialBoardPath("jt-combo", { date: "2026-11-11", venue: "HV", section: "combo" })).toBe("/api/official/jt-combo?date=2026-11-11&venue=HV&section=combo");
    expect(officialBoardPath("jt-combo", { date: "2026-11-11", venue: "HV", section: "nope" })).toBe("/api/official/jt-combo?date=2026-11-11&venue=HV");
    expect(officialBoardPath("finish-photos", { date: "2026-11-08", venue: "ST", raceNo: 1 })).toBe("/api/official/finish-photos?date=2026-11-08&venue=ST&raceNo=1");
    expect(officialBoardPath("finish-photos", { date: "2026-11-08", venue: "ST", raceNo: 0 })).toBe("/api/official/finish-photos?date=2026-11-08&venue=ST");
    expect(officialBoardPath("challenge-odds", { date: "2026-11-08", venue: "ST", pool: "jkc" })).toBe("/api/official/challenge-odds?pool=jkc&date=2026-11-08&venue=ST");
    expect(officialBoardPath("challenge-odds", { pool: "jkc" })).toBeNull();
    expect(officialBoardPath("challenge-odds", { date: "2026-11-08", venue: "ST", pool: "jwc" })).toBe("/api/official/challenge-odds?date=2026-11-08&venue=ST");
  });

  it("名冊可以唔帶賽日，烙號唔合規格就唔查", () => {
    expect(officialBoardPath("special-index", {})).toBe("/api/official/special-index");
    expect(officialBoardPath("ove-database", { asOf: "2026-11-10" })).toBe("/api/official/ove-database?asOf=2026-11-10");
    expect(officialBoardPath("ove-database", { asOf: "yesterday" })).toBe("/api/official/ove-database");
    expect(officialBoardPath("ppo-performance", { season: "2026-2027", brand: "j313" })).toBe("/api/official/ppo-performance?season=2026-2027&brand=J313");
    expect(officialBoardPath("ppo-performance", { season: "this-season" })).toBe("/api/official/ppo-performance");
    expect(officialBoardPath("horse-former-name", { brand: "J313" })).toBe("/api/official/horse-former-name?brand=J313");
    expect(officialBoardPath("horse-former-name", {})).toBe("/api/official/horse-former-name");
    expect(officialBoardPath("horse-former-name", { brand: "CN014" })).toBeNull();
    expect(officialBoardPath("horse-former-name", { brand: "ZZZZ" })).toBeNull();
    expect(asLocalBrand("k308")).toBe("K308");
  });
});

describe("官方信封", () => {
  it("缺表回 available false 時唔保留行", () => {
    expect(readEnvelope({ source: "official_special_index", available: false, rows: [{ code: "DISQ", noteCh: "取消資格" }] })).toMatchObject({
      available: false,
      rows: [],
    });
    expect(emptyBoardLabel(false)).toBe("暫時未有呢項官方資料。");
    expect(emptyBoardLabel(true)).toBe("呢個範圍未有收錄。");
  });

  it("空白行係未收錄，唔係造資料", () => {
    expect(readEnvelope({ source: "official_fwb_declared", available: true, date: "2026-11-14", venue: "ST", rows: [] })).toMatchObject({
      available: true,
      rows: [],
      date: "2026-11-14",
      venue: "ST",
    });
  });

  it("唔係信封就拒絕", () => {
    expect(readEnvelope(null)).toBeNull();
    expect(readEnvelope({ rows: [] })).toBeNull();
  });
});

describe("官方行", () => {
  it("特別註解係顯示字句，第一行 DISQ 取消資格", () => {
    const rows = readSpecialIndex(envelope([
      { code: "DISQ", lineNo: 1, noteCh: "取消資格", notRaceResult: true },
      { code: "DNF", lineNo: 2, noteCh: "未有跑畢全程", notRaceResult: true },
    ]));
    expect(rows[0]).toEqual({ code: "DISQ", lineNo: 1, noteCh: "取消資格", notRaceResult: true });
    expect(rows[0]).not.toHaveProperty("finishingPosition");
    expect(rows).toHaveLength(2);
  });

  it("賽日獸醫檢查保留原文，唔當名次", () => {
    const rows = readOveRows(envelope([{
      raceNo: 1, lineNo: 1, horseNo: 1, reserve: false, horseCode: "K308", horseName: "電路一百",
      injuryDate: "2026-10-01", detail: "賽後內窺鏡檢查發現氣管內有大量血液", passedDate: "2026-11-03", notRaceResult: true,
    }]));
    expect(rows[0]).toMatchObject({ horseCode: "K308", horseName: "電路一百", detail: "賽後內窺鏡檢查發現氣管內有大量血液", notRaceResult: true });
    expect(rows[0]).not.toHaveProperty("finishingPosition");
  });

  it("騎練合作冇馬名就保持空白", () => {
    const rows = readJtRows(envelope([
      { section: "combo", raceNo: 1, horseNo: 1, horseName: null, importType: null, trainerName: null, winRate: "0.0000", placeRate: "0.0900", asOfText: "10/11/2026 12:00", notRaceResult: true },
      { section: "debut", raceNo: 7, horseNo: 10, horseName: "輝煌猛將", importType: "自購馬", trainerName: "呂健威", winRate: "0.1400", placeRate: "0.1400", asOfText: "10/11/2026 12:00", notRaceResult: true },
    ]));
    expect(rows[0]?.horseName).toBeNull();
    expect(formatOfficialRate(rows[0]?.placeRate)).toBe("9.0%");
    expect(rows[1]?.horseName).toBe("輝煌猛將");
    expect(formatOfficialRate("nope")).toBe("—");
  });

  it("特別獎金同曾用名照收錄原文", () => {
    expect(readFwbRows(envelope([{
      raceNo: 7, horseNo: 8, reserve: false, horseNameEn: "MASK WARRIOR", horseNameCh: "假面勇士", brand: "L518",
      bonusEn: "PP Bonus of HK$1.5M", bonusCh: "「自購曾出賽馬匹特別獎金」一百五十萬港元", notRaceResult: true,
    }]))[0]).toMatchObject({ horseNameCh: "假面勇士", brand: "L518" });
    expect(readFormerNames(envelope([{
      horseId: "HK_2026_J313", brand: "J313", nameEn: "BEAR CHAMP", nameCh: "叻叻熊", formerName: "Bear Champ",
      sire: "Hellbent", dam: "Mumford", importType: "PP", importTypeCh: "自購馬", originCode: "AUS", originCh: "澳洲",
      age: 5, foalingDate: "2021-08-21", notRaceResult: true,
    }]))[0]).toMatchObject({ nameCh: "叻叻熊", formerName: "Bear Champ", notRaceResult: true });
  });

  it("終點照片只接受馬會終點照片網址", () => {
    const path = "https://consvc.hkjc.com/-/media/Sites/JCRW/FinishPhotos/26_27/20261108/20261108R01_P3.jpg";
    expect(finishPhotoUrl(path)).toBe(path);
    expect(finishPhotoUrl("https://example.com/photo.jpg")).toBeNull();
    expect(finishPhotoUrl("https://consvc.hkjc.com/-/media/Sites/JCRW/FinishPhotos/../secret.jpg")).toBeNull();
    expect(readFinishPhotos(envelope([
      { raceNo: 1, photoCode: "P3", seasonCode: "26_27", imagePath: path, notRaceResult: true },
      { raceNo: 1, photoCode: "X", seasonCode: "26_27", imagePath: "https://example.com/a.jpg", notRaceResult: true },
    ]))).toEqual([{ raceNo: 1, photoCode: "P3", seasonCode: "26_27", imagePath: path, notRaceResult: true }]);
  });

  it("挑戰賠率第 0 場係開盤", () => {
    const rows = readChallengeRows(envelope([
      { pool: "jkc", date: "2026-11-08", venue: "ST", winnerCode: "AA", winnerName: "艾兆禮", points: 40, raceNo: 0, oddsText: "3.00", chartUpdatedAt: "2026-11-08T18:03:00+08:00", notRaceResult: true },
      { pool: "jkc", date: "2026-11-08", venue: "ST", winnerCode: "AA", winnerName: "艾兆禮", points: 40, raceNo: 1, oddsText: "3.00", chartUpdatedAt: "2026-11-08T18:03:00+08:00", notRaceResult: true },
      { pool: "tnc", date: "2026-11-08", venue: "ST", winnerCode: "CAS", winnerName: "告東尼", points: 40, raceNo: 0, oddsText: "5.00", chartUpdatedAt: "2026-11-08T18:04:00+08:00", notRaceResult: true },
    ]));
    expect(challengeRaceLabel(0)).toBe("開盤");
    expect(challengeRaceLabel(1)).toBe("第1場");
    const grouped = groupChallenge(rows);
    expect(grouped.map((group) => group.label)).toEqual(["騎師王", "練馬師王"]);
    expect(grouped[0]?.people[0]?.cells[0]).toEqual({ raceNo: 0, label: "開盤", oddsText: "3.00" });
    expect(grouped[0]?.people[0]?.winnerName).toBe("艾兆禮");
    expect(rows[0]).not.toHaveProperty("finishingPosition");
  });
});

describe("瀏覽", () => {
  it("有賽日就開賽日板，否則開名冊", () => {
    expect(officialScopeOf({ date: "2026-11-11", venue: "HV" })).toBe("meeting");
    expect(officialScopeOf({})).toBe("directory");
    expect(officialScopeOf({ scope: "directory", date: "2026-11-11", venue: "HV" })).toBe("directory");
  });

  it("篩選同分頁唔會造行", () => {
    const rows = [{ name: "叻叻熊" }, { name: "假面勇士" }];
    expect(filterRows(rows, "熊", (row) => row.name)).toEqual([{ name: "叻叻熊" }]);
    expect(filterRows(rows, "", (row) => row.name)).toHaveLength(2);
    expect(pageOf([1, 2, 3], 2, 2)).toEqual({ page: 2, pages: 2, slice: [3] });
    expect(pageOf([], 4, 40)).toEqual({ page: 1, pages: 1, slice: [] });
  });
});
