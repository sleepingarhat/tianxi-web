/**
 * 單場取消同平頭名次嘅顯示。只讀已有 API 欄位，唔改命中公式、唔補官方名次。
 * 全日停賽仍然行 MeetingCancellationNotice，唔經呢度。
 */

export type RaceVoid = {
  label: string;
  reason: string;
  refund: boolean;
};

type VoidInput = {
  status?: string | null | undefined;
  cardStatus?: string | null | undefined;
  cancelled?: boolean | null | undefined;
  void?: boolean | null | undefined;
  refund?: boolean | null | undefined;
  label?: string | null | undefined;
  reason?: string | null | undefined;
  officialMessage?: string | null | undefined;
};

function officialLabel(value: unknown): string {
  if (typeof value !== "string") return "取消";
  const text = value.trim();
  return /^[\u4e00-\u9fff]{1,6}$/.test(text) ? text : "取消";
}

function officialReason(values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const text = value.replace(/\s+/g, " ").trim();
    if (text) return text.slice(0, 400);
  }
  return "";
}

/** 單場作廢。status／cardStatus／cancelled／void 任一成立先算，唔會因賽日已有賽果而當成完場。 */
export function raceVoidOf(input: VoidInput | null | undefined): RaceVoid | null {
  if (!input) return null;
  const flagged =
    input.cardStatus === "cancelled" ||
    input.status === "cancelled" ||
    input.cancelled === true ||
    input.void === true;
  if (!flagged) return null;
  return {
    label: officialLabel(input.label),
    reason: officialReason([input.officialMessage, input.reason]),
    refund: input.refund === true,
  };
}

export type Finisher = {
  horseNumber?: unknown;
  finishingPosition?: unknown;
};

/** 名次 1 至 maxPlace 嘅所有馬，包括平頭。唔會把第二匹季軍改成第 4。 */
export function finishersThrough<T extends Finisher>(
  rows: readonly T[] | null | undefined,
  maxPlace: number,
): T[] {
  return (rows ?? [])
    .filter((row) => {
      const position = Number(row.finishingPosition);
      const horseNumber = Number(row.horseNumber);
      return (
        Number.isInteger(position) &&
        position >= 1 &&
        position <= maxPlace &&
        Number.isInteger(horseNumber) &&
        horseNumber > 0
      );
    })
    .sort(
      (a, b) =>
        Number(a.finishingPosition) - Number(b.finishingPosition) ||
        Number(a.horseNumber) - Number(b.horseNumber),
    );
}

/**
 * 位置集合齊 1..maxPlace 先算完整（平頭可以多過 maxPlace 匹）。
 * 缺任一官方名次就唔當已核實頭三／頭四。
 */
export function placedHorseNumbers(
  results: readonly Finisher[] | null | undefined,
  maxPlace: number,
): { numbers: number[]; complete: boolean } {
  const horses = finishersThrough(results, maxPlace);
  const positions = new Set(horses.map((horse) => Number(horse.finishingPosition)));
  let complete = horses.length >= maxPlace;
  for (let place = 1; place <= maxPlace; place += 1) {
    if (!positions.has(place)) complete = false;
  }
  return { numbers: horses.map((horse) => Number(horse.horseNumber)), complete };
}

/** 有官方名次就用官方名次；舊資料冇名次先先後次序。 */
export function displayFinishPosition(finishingPosition: unknown, index: number): number {
  const position =
    typeof finishingPosition === "number" ? finishingPosition : Number(finishingPosition);
  if (Number.isInteger(position) && position >= 1 && position < 99) return position;
  return index + 1;
}

/** 預測對賽果導覽。作廢場顯示取消，凍結四揀仍然留喺側欄。 */
export function comparisonMark(input: {
  voided: boolean;
  redacted: boolean;
  hits: number | null;
}): string {
  if (input.voided) return "取消";
  if (input.redacted) return "需登入";
  if (input.hits == null || !Number.isInteger(input.hits)) return "待核";
  return `${input.hits}/4`;
}

/** 賽果核對場次標籤。作廢唔當未核實。 */
export function auditStatusLabel(input: {
  voided: boolean;
  eligible: boolean;
  hits: number | null;
  invalidPrelock: boolean;
}): string {
  if (input.voided) return "取消，不計入";
  if (input.eligible && typeof input.hits === "number") return `原四揀中 ${input.hits}/4`;
  if (input.invalidPrelock) return "鎖前輸入無效";
  return "待核，不計分";
}

/** 逐賽日位置Q。有命中數同分母就寫 2/10，否則先用 API 百分比。 */
export function formatMeetingQp(
  row: { qpHits?: unknown; racesEvaluated?: unknown; qpHitRate?: unknown } | null | undefined,
): string {
  if (!row) return "—";
  const hits = row.qpHits;
  const evaluated = row.racesEvaluated;
  if (
    typeof hits === "number" &&
    Number.isInteger(hits) &&
    hits >= 0 &&
    typeof evaluated === "number" &&
    Number.isInteger(evaluated) &&
    evaluated > 0 &&
    hits <= evaluated
  ) {
    return `${hits}/${evaluated}`;
  }
  if (typeof row.qpHitRate === "number" && Number.isFinite(row.qpHitRate))
    return `${row.qpHitRate.toFixed(1)}%`;
  return "—";
}
