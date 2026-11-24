import { describe, expect, it } from "vitest";

import {
  auditStatusLabel,
  comparisonMark,
  displayFinishPosition,
  finishersThrough,
  formatMeetingQp,
  placedHorseNumbers,
  raceVoidOf,
} from "./race-settlement-display";

const REFUND = "此場賽事宣佈取消。根據賽馬博彩規例，若此賽事設有單場彩池，有關注項將予以退款。";

describe("單場取消", () => {
  it("2026-11-14 第6場用官方取消同退款原文，唔繼承賽日已有賽果", () => {
    const race = raceVoidOf({
      status: "cancelled",
      cardStatus: "cancelled",
      cancelled: true,
      void: true,
      refund: true,
      label: "取消",
      reason: REFUND,
      officialMessage: REFUND,
    });
    expect(race).toEqual({ label: "取消", reason: REFUND, refund: true });
    expect(
      raceVoidOf({ status: "resulted", cancelled: false, void: false, cardStatus: null }),
    ).toBeNull();
    expect(raceVoidOf({ cardStatus: "resulted" })).toBeNull();
  });

  it("對帳標取消，凍結四揀唔當待核", () => {
    expect(comparisonMark({ voided: true, redacted: false, hits: null })).toBe("取消");
    expect(
      auditStatusLabel({ voided: true, eligible: false, hits: null, invalidPrelock: false }),
    ).toBe("取消，不計入");
    expect(comparisonMark({ voided: false, redacted: false, hits: null })).toBe("待核");
    expect(
      auditStatusLabel({ voided: false, eligible: true, hits: 2, invalidPrelock: false }),
    ).toBe("原四揀中 2/4");
  });
});

describe("平頭名次", () => {
  const race7 = [
    { horseNumber: 9, finishingPosition: 1 },
    { horseNumber: 8, finishingPosition: 2 },
    { horseNumber: 6, finishingPosition: 3 },
    { horseNumber: 13, finishingPosition: 3 },
    { horseNumber: 5, finishingPosition: 5 },
  ];

  it("兩匹季軍都保留第3，唔會改成第4或藏起其中一匹", () => {
    expect(
      finishersThrough(race7, 4).map((horse) => [horse.horseNumber, horse.finishingPosition]),
    ).toEqual([
      [9, 1],
      [8, 2],
      [6, 3],
      [13, 3],
    ]);
    expect(displayFinishPosition(3, 3)).toBe(3);
    const top3 = placedHorseNumbers(race7, 3);
    expect(top3.complete).toBe(true);
    expect(top3.numbers).toEqual([9, 8, 6, 13]);
  });

  it("缺第3名唔當頭三已齊", () => {
    expect(
      placedHorseNumbers(
        [
          { horseNumber: 1, finishingPosition: 1 },
          { horseNumber: 2, finishingPosition: 2 },
        ],
        3,
      ).complete,
    ).toBe(false);
  });

  it("11月14日位置Q顯示 2/10", () => {
    expect(formatMeetingQp({ qpHits: 2, racesEvaluated: 10, qpHitRate: 20 })).toBe("2/10");
    expect(formatMeetingQp({ qpHitRate: 20 })).toBe("20.0%");
  });
});
