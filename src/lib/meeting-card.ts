/**
 * 賽程同排位顯示。cardStatus／drawStatus 先於舊欄位 isEntryListOnly：
 * 現行 /api/meetings/smart/current 對已出正式排位的賽日仍會回 isEntryListOnly=true。
 */

export type CardStatus = "fixture" | "entries" | "declared" | "resulted";
export type DrawStatus = "unavailable" | "published";

const CARD_STATUS: Record<CardStatus, string> = {
  fixture: "賽期",
  entries: "已報名",
  declared: "正式排位",
  resulted: "已有賽果",
};

const CARRIED_MIN = 80;
const CARRIED_MAX = 180;

export function cardStatusOf(input: {
  cardStatus?: string | null | undefined;
  isDeclaredCard?: boolean | null | undefined;
}): CardStatus | null {
  const raw = input.cardStatus;
  if (raw === "fixture" || raw === "entries" || raw === "declared" || raw === "resulted") return raw;
  if (input.isDeclaredCard === true) return "declared";
  return null;
}

export function cardStatusLabel(status: CardStatus | null): string {
  return status ? CARD_STATUS[status] : "";
}

export function drawStatusOf(value: string | null | undefined): DrawStatus | null {
  return value === "unavailable" || value === "published" ? value : null;
}

export function drawStatusLabel(status: DrawStatus | null): string {
  if (status === "unavailable") return "檔位未公布";
  if (status === "published") return "檔位已公布";
  return "";
}

/** 場次有自己的狀態就用場次；否則用賽日。 */
export function effectiveDrawStatus(
  race?: { drawStatus?: string | null | undefined } | null,
  meeting?: { drawStatus?: string | null | undefined } | null,
): DrawStatus | null {
  return drawStatusOf(race?.drawStatus) ?? drawStatusOf(meeting?.drawStatus);
}

export function effectiveCardStatus(
  race?: { cardStatus?: string | null | undefined; isDeclaredCard?: boolean | null | undefined } | null,
  meeting?: { cardStatus?: string | null | undefined; isDeclaredCard?: boolean | null | undefined } | null,
): CardStatus | null {
  return cardStatusOf(race ?? {}) ?? cardStatusOf(meeting ?? {});
}

/** 檔位未公布時唔顯示任何檔號，即使上游誤附數字。 */
export function visibleBarrier(draw: unknown, drawStatus?: string | null): number | null {
  if (drawStatus === "unavailable") return null;
  const n = typeof draw === "number" ? draw : typeof draw === "string" && /^\d{1,2}$/.test(draw.trim()) ? Number(draw) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > 14) return null;
  return n;
}

function asNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function isCarried(value: number | null): value is number {
  return value != null && value >= CARRIED_MIN && value <= CARRIED_MAX;
}

export type RunnerWeights = {
  /** 負磅／讓磅。唔會用排位體重頂替。 */
  imposed: number | null;
  /** 排位體重。 */
  body: number | null;
};

export function runnerWeights(horse: {
  weight?: unknown;
  bodyWeight?: unknown;
  declaredWeight?: unknown;
  actualWeight?: unknown;
}): RunnerWeights {
  const weight = asNumber(horse.weight);
  const declared = asNumber(horse.declaredWeight);
  const actual = asNumber(horse.actualWeight);
  const directBody = asNumber(horse.bodyWeight);
  let body: number | null = directBody != null && directBody > CARRIED_MAX ? directBody : null;
  if (body == null && weight != null && weight > CARRIED_MAX) body = weight;
  if (body == null && declared != null && declared > CARRIED_MAX) body = declared;
  const imposed = [weight, declared, actual].find((n) => isCarried(n) && n !== body) ?? null;
  return { imposed: imposed ?? null, body };
}

export function imposedWeightLabel(title?: string | null | undefined): "讓磅" | "負磅" {
  return title && /讓賽|讓磅/.test(title) ? "讓磅" : "負磅";
}

export function formatPounds(value: number | null): string {
  if (value == null) return "—";
  return Number.isInteger(value) ? String(value) : String(value);
}

export type Measure = { label: string; value: string };

/** 已報名／賽期冇負磅、排位體重、檔位時略去，避免砌成一張空白正式排位。正式排位同賽果兩項磅數都列出。 */
export function runnerMeasures(input: {
  horse: {
    draw?: unknown;
    weight?: unknown;
    bodyWeight?: unknown;
    declaredWeight?: unknown;
    actualWeight?: unknown;
  };
  title?: string | null | undefined;
  cardStatus?: string | null | undefined;
  isDeclaredCard?: boolean | null | undefined;
  drawStatus?: string | null | undefined;
}): Measure[] {
  const status = cardStatusOf(input);
  const omitEmpty = status === "entries" || status === "fixture";
  const weights = runnerWeights(input.horse);
  const draw = visibleBarrier(input.horse.draw, input.drawStatus);
  const rows: { label: string; value: number | null }[] = [
    { label: "檔位", value: draw },
    { label: imposedWeightLabel(input.title), value: weights.imposed },
    { label: "排位體重", value: weights.body },
  ];
  return rows.flatMap((row) => {
    if (row.value == null && omitEmpty) return [];
    return [{ label: row.label, value: formatPounds(row.value) }];
  });
}

export function meetingRacesEmptyLabel(status: CardStatus | null): string {
  if (status === "fixture") return "賽期已公布，出賽名單未公布";
  if (status === "entries") return "已報名，暫未讀到出賽名單";
  if (status === "declared") return "正式排位暫未讀到";
  return "此日未有場次資料";
}

export function showsDeclaredCard(status: CardStatus | null): boolean {
  return status === "declared" || status === "resulted";
}
