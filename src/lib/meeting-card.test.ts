import { describe, expect, it } from "vitest";

import {
  cardStatusLabel,
  cardStatusOf,
  displayedCardStatus,
  effectiveDrawStatus,
  imposedWeightLabel,
  meetingRacesEmptyLabel,
  runnerFormCells,
  runnerMeasures,
  runnerWeights,
  visibleBarrier,
} from "./meeting-card";

describe("賽日狀態", () => {
  it("四種 cardStatus 各有標籤，已報名唔當正式排位", () => {
    expect(cardStatusOf({ cardStatus: "entries", isDeclaredCard: false })).toBe("entries");
    expect(cardStatusLabel("entries")).toBe("已報名");
    expect(cardStatusLabel("fixture")).toBe("賽期");
    expect(cardStatusLabel("declared")).toBe("正式排位");
    expect(cardStatusLabel("resulted")).toBe("已有賽果");
    expect(cardStatusOf({ cardStatus: "entries", isDeclaredCard: false })).not.toBe("declared");
  });

  it("單場賽果冇狀態時，用賽日；排位表自己有狀態時唔使等賽日", () => {
    expect(displayedCardStatus({ cardStatus: null }, { cardStatus: "resulted" }, { cardStatus: null })).toBe("resulted");
    expect(displayedCardStatus(null, null, { cardStatus: "declared" })).toBe("declared");
    expect(displayedCardStatus(null, null, { cardStatus: "entries" })).toBe("entries");
  });

  it("未有 cardStatus 時，只有 isDeclaredCard 真先當正式排位", () => {
    expect(cardStatusOf({ isDeclaredCard: true })).toBe("declared");
    expect(cardStatusOf({ isDeclaredCard: false })).toBeNull();
  });

  it("賽期冇場次時講明出賽名單未公布", () => {
    expect(meetingRacesEmptyLabel("fixture")).toBe("賽期已公布，出賽名單未公布");
    expect(meetingRacesEmptyLabel("entries")).toBe("已報名，暫未讀到出賽名單");
  });
});

describe("檔位", () => {
  it("檔位未公布時唔顯示數字，即使上游附了檔號", () => {
    expect(visibleBarrier(2, "unavailable")).toBeNull();
    expect(visibleBarrier("2", "unavailable")).toBeNull();
  });

  it("已公布先顯示 1 至 14 的檔位", () => {
    expect(visibleBarrier(2, "published")).toBe(2);
    expect(visibleBarrier(2, null)).toBe(2);
    expect(visibleBarrier(0, "published")).toBeNull();
    expect(visibleBarrier(15, "published")).toBeNull();
  });

  it("場次狀態優先於賽日", () => {
    expect(effectiveDrawStatus({ drawStatus: "unavailable" }, { drawStatus: "published" })).toBe("unavailable");
    expect(effectiveDrawStatus({}, { drawStatus: "published" })).toBe("published");
  });
});

describe("負磅同排位體重", () => {
  it("正式排位分開列負磅 135 同排位體重 1101", () => {
    expect(runnerWeights({ weight: 135, bodyWeight: 1101, declaredWeight: 135, actualWeight: 133 })).toEqual({
      imposed: 135,
      body: 1101,
    });
    expect(imposedWeightLabel("爵祿讓賽")).toBe("讓磅");
    expect(runnerMeasures({
      horse: { draw: 2, weight: 135, bodyWeight: 1101, declaredWeight: 135, actualWeight: 133 },
      title: "爵祿讓賽",
      cardStatus: "declared",
      drawStatus: "published",
    })).toEqual([
      { label: "檔位", value: "2" },
      { label: "讓磅", value: "135" },
      { label: "排位體重", value: "1101" },
    ]);
  });

  it("賽果的體重唔標成負磅，兩項都保留", () => {
    expect(runnerWeights({ weight: 126, bodyWeight: 1208, declaredWeight: null, actualWeight: 126 })).toEqual({
      imposed: 126,
      body: 1208,
    });
    expect(runnerWeights({ weight: 126, declaredWeight: 1100 })).toEqual({ imposed: 126, body: 1100 });
    expect(runnerWeights({ weight: 1101 })).toEqual({ imposed: null, body: 1101 });
  });

  it("已報名兩邊都空白時略去，唔砌檔位或磅數", () => {
    expect(runnerWeights({ weight: null, bodyWeight: null, declaredWeight: null, actualWeight: null })).toEqual({
      imposed: null,
      body: null,
    });
    expect(runnerMeasures({
      horse: { draw: null, weight: null, bodyWeight: null },
      title: "樂聲盃（讓賽）",
      cardStatus: "entries",
      isDeclaredCard: false,
      drawStatus: "unavailable",
    })).toEqual([]);
  });

  it("非讓賽用負磅", () => {
    expect(imposedWeightLabel("一級賽")).toBe("負磅");
  });

  it("官方四格唔會混入檔位或磅數", () => {
    expect(runnerMeasures({
      horse: {
        draw: 2,
        weight: 135,
        bodyWeight: 1101,
        ratingChange: -1,
        bodyWeightChange: 29,
        bestTime: "1.42.43",
        daysSinceRun: 41,
      },
      title: "爵祿讓賽",
      cardStatus: "declared",
      drawStatus: "published",
    })).toEqual([
      { label: "檔位", value: "2" },
      { label: "讓磅", value: "135" },
      { label: "排位體重", value: "1101" },
    ]);
  });
});

describe("官方排位格", () => {
  it("正式排位顯示評分變化、排位體重變化、最佳時間、上賽距今日數、可能超磅同分齡讓磅", () => {
    expect(runnerFormCells({
      horse: {
        ratingChange: -1,
        bodyWeightChange: 29,
        bestTime: "1.42.43",
        daysSinceRun: 41,
        possibleOverweight: null,
        ageAllowance: null,
        weight: 135,
        bodyWeight: 1101,
        draw: 2,
      },
      cardStatus: "declared",
    })).toEqual([
      { label: "評分+/\u2212", value: "-1" },
      { label: "排位體重+/\u2212", value: "+29" },
      { label: "最佳時間", value: "1.42.43" },
      { label: "上賽距今日數", value: "41" },
      { label: "可能超磅", value: "—" },
      { label: "分齡讓磅", value: "—" },
    ]);
  });

  it("可能超磅 1、分齡讓磅空白分開顯示", () => {
    expect(runnerFormCells({
      horse: { possibleOverweight: 1, ageAllowance: null },
      cardStatus: "declared",
    }).slice(4)).toEqual([
      { label: "可能超磅", value: "1" },
      { label: "分齡讓磅", value: "—" },
    ]);
    expect(runnerFormCells({
      horse: { possibleOverweight: "1", ageAllowance: 0 },
      cardStatus: "resulted",
    }).slice(4)).toEqual([
      { label: "可能超磅", value: "1" },
      { label: "分齡讓磅", value: "0" },
    ]);
    expect(runnerFormCells({
      horse: { possibleOverweight: 1.5, ageAllowance: "x" },
      cardStatus: "declared",
    }).slice(4)).toEqual([
      { label: "可能超磅", value: "—" },
      { label: "分齡讓磅", value: "—" },
    ]);
  });

  it("零同空白分開，最佳時間保持馬會寫法", () => {
    expect(runnerFormCells({
      horse: { ratingChange: 0, bodyWeightChange: 0, bestTime: null, daysSinceRun: 23 },
      cardStatus: "declared",
    })).toEqual([
      { label: "評分+/\u2212", value: "0" },
      { label: "排位體重+/\u2212", value: "0" },
      { label: "最佳時間", value: "—" },
      { label: "上賽距今日數", value: "23" },
      { label: "可能超磅", value: "—" },
      { label: "分齡讓磅", value: "—" },
    ]);
    expect(runnerFormCells({
      horse: { ratingChange: "5", bodyWeightChange: "-13", bestTime: " 1.09.64 ", daysSinceRun: "31" },
      cardStatus: "declared",
    })).toEqual([
      { label: "評分+/\u2212", value: "+5" },
      { label: "排位體重+/\u2212", value: "-13" },
      { label: "最佳時間", value: "1.09.64" },
      { label: "上賽距今日數", value: "31" },
      { label: "可能超磅", value: "—" },
      { label: "分齡讓磅", value: "—" },
    ]);
    expect(runnerFormCells({
      horse: { ratingChange: 1.5, bodyWeightChange: 29, bestTime: "1:42.43", daysSinceRun: 41.2 },
      cardStatus: "resulted",
    })).toEqual([
      { label: "評分+/\u2212", value: "—" },
      { label: "排位體重+/\u2212", value: "+29" },
      { label: "最佳時間", value: "—" },
      { label: "上賽距今日數", value: "—" },
      { label: "可能超磅", value: "—" },
      { label: "分齡讓磅", value: "—" },
    ]);
  });

  it("已報名四項都空白就略去，可能超磅有值都唔顯示", () => {
    expect(runnerFormCells({
      horse: { ratingChange: null, bodyWeightChange: null, bestTime: null, daysSinceRun: null },
      cardStatus: "entries",
      isDeclaredCard: false,
    })).toEqual([]);
    expect(runnerFormCells({
      horse: {
        ratingChange: null,
        bodyWeightChange: null,
        bestTime: null,
        daysSinceRun: null,
        possibleOverweight: 1,
        ageAllowance: 5,
      },
      cardStatus: "entries",
      isDeclaredCard: false,
    })).toEqual([]);
    expect(runnerFormCells({
      horse: { possibleOverweight: 1, ageAllowance: null },
      cardStatus: "fixture",
    })).toEqual([]);
    expect(runnerFormCells({
      horse: { ratingChange: -1, possibleOverweight: 1, ageAllowance: 2 },
      cardStatus: "entries",
      isDeclaredCard: false,
    })).toEqual([{ label: "評分+/\u2212", value: "-1" }]);
  });

  it("賽果未回六項時顯示破折號，唔用完成時間補", () => {
    expect(runnerFormCells({
      horse: { ratingChange: null, bodyWeightChange: null, bestTime: null, daysSinceRun: null, weight: 126, bodyWeight: 1208 },
      cardStatus: "resulted",
    }).map((cell) => cell.value)).toEqual(["—", "—", "—", "—", "—", "—"]);
  });
});
