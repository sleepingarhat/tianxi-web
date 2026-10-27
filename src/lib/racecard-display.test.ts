import { describe, expect, it } from "vitest";
import { parseRacecardDisplay } from "./racecard-display";

const HEADER = `
<div class="f_fs13"><span class="font_wb" />第 1 場 - 畫眉山讓賽</span><br>
2026年10月28日, 星期三, 沙田, 18:45<br>全天候跑道, 1650米, 好地<br>獎金: $875,000, 評分: 40-0, 第五班</div>
<table><tr><td>01/10/24</td><td>沙田</td><td>草地 1200米</td><td>好地</td></tr></table>
<a href="?RaceNo=2">第 2 場</a>
`;

describe("公開排位標題途程", () => {
  it("用標題列途程，唔用往績入面嘅米數", () => {
    expect(parseRacecardDisplay(HEADER, { date: "2026-10-28", venue: "ST", raceNumber: 1 })).toMatchObject({
      matched: true,
      distance: 1650,
      going: "好地",
      surface: "全天候跑道",
      title: "畫眉山讓賽",
    });
  });

  it("場次或日期唔啱就唔當有途程", () => {
    expect(parseRacecardDisplay(HEADER, { date: "2026-10-28", venue: "ST", raceNumber: 2 }).distance).toBeNull();
    expect(parseRacecardDisplay(HEADER, { date: "2026-10-25", venue: "ST", raceNumber: 1 })).toMatchObject({ matched: false, distance: null });
    expect(parseRacecardDisplay(HEADER, { date: "2026-10-28", venue: "HV", raceNumber: 1 })).toMatchObject({ matched: false, distance: null });
  });

  it("草地標題都讀到米數", () => {
    const turf = `第 3 場 - 讓賽 2026年10月25日, 星期日, 沙田, 13:10 草地 - "A" 賽道, 1200米, 好地至快地`;
    expect(parseRacecardDisplay(turf, { date: "2026-10-25", venue: "ST", raceNumber: 3 })).toMatchObject({
      matched: true,
      distance: 1200,
      going: "好地至快地",
    });
  });
});
