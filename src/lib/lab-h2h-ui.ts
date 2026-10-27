import type { EChartsOption } from "echarts";

import type { LabH2hPayload, LabSearchItem } from "./lab-h2h.functions";
import { validateEntityId, type LabEntityType } from "./lab-entity-id";

export const H2H_PRODUCT_LABEL = "馬騎練數據獨立比較";

export { validateEntityId };
export type { LabEntityType };

/** 香港常見途程。空 id＝全部。 */
export const H2H_DISTANCE_OPTIONS = [
  { id: "", label: "全部" },
  ...([1000, 1200, 1400, 1600, 1650, 1800, 2000, 2200, 2400] as const).map((d) => ({
    id: String(d),
    label: `${d} 米`,
  })),
] as const;

/**
 * 中文地況桶對齊既有 normalizeGoingBucket 清單。
 * 空 id＝全部，唔再自由打字。
 */
export const H2H_GOING_OPTIONS = [
  { id: "", label: "全部" },
  ...(
    [
      "好地",
      "好地至快地",
      "快地",
      "好地至黏地",
      "黏地",
      "黏地至軟地",
      "軟地",
      "濕快地",
      "濕慢地",
      "濕地",
      "大爛地",
      "封地",
    ] as const
  ).map((going) => ({ id: going, label: going })),
] as const;

/** 深連結舊值唔喺目錄時仍可顯示，避免已套用條件消失。 */
export function withCurrentChoice<T extends { id: string; label: string }>(
  options: readonly T[],
  current: string,
): { id: string; label: string }[] {
  if (!current || options.some((option) => option.id === current))
    return options.map((option) => ({ ...option }));
  return [...options.map((option) => ({ ...option })), { id: current, label: current }];
}

export function eloEmptyLabel(type: LabEntityType): string {
  if (type === "trainer") return "練馬師暫未有 Elo 走勢；條件、跑法同交手仍可對照";
  return "暫時未有 Elo 快照";
}

export function selectableEntities(
  type: LabEntityType,
  items: readonly LabSearchItem[],
): LabSearchItem[] {
  return items.filter((item) => validateEntityId(type, item.id));
}

/**
 * 練馬師搜尋優先用 lab search API 結果；API 未返回可用 id 時退回公開練馬師名單。
 */
export function resolveTrainerCatalog(input: {
  query: string;
  searchItems: readonly LabSearchItem[] | null;
  publicItems: readonly LabSearchItem[];
}): { items: LabSearchItem[]; fromSearch: boolean } {
  const query = input.query.trim();
  if (query && input.searchItems) {
    const fromApi = selectableEntities("trainer", input.searchItems);
    if (fromApi.length > 0) return { items: fromApi, fromSearch: true };
  }
  return { items: selectableEntities("trainer", input.publicItems), fromSearch: false };
}

export function filterEntities(items: readonly LabSearchItem[], query: string): LabSearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  return items.filter((item) =>
    [item.nameCh, item.nameEn, item.code, item.id]
      .filter((part): part is string => !!part)
      .join(" ")
      .toLowerCase()
      .includes(q),
  );
}

export function entityLabel(e: {
  nameCh: string | null;
  nameEn: string | null;
  code: string | null;
  id: string;
}): string {
  return e.nameCh || e.nameEn || e.code || e.id;
}

export function venueLabel(v: string | null | undefined): string {
  if (v === "ST") return "沙田";
  if (v === "HV") return "跑馬地";
  return v || "—";
}

export function aheadLabel(ahead: "a" | "b" | "tie" | null, nameA: string, nameB: string): string {
  if (ahead === "a") return `${nameA} 較前`;
  if (ahead === "b") return `${nameB} 較前`;
  if (ahead === "tie") return "同名次";
  return "—";
}

/** Elo 雙線＋同場日出賽標註。缺快照時回傳空序列，唔擲錯。 */
export function buildEloOption(payload: {
  entities: LabH2hPayload["entities"];
  elo?: LabH2hPayload["elo"] | null;
}): EChartsOption {
  const nameA = entityLabel(payload.entities.a);
  const nameB = entityLabel(payload.entities.b);
  const pointsA = payload.elo?.a ?? [];
  const pointsB = payload.elo?.b ?? [];
  const meetings = payload.elo?.meetings ?? [];
  const dates = new Set<string>();
  for (const p of pointsA) dates.add(p.date);
  for (const p of pointsB) dates.add(p.date);
  const x = [...dates].sort();
  const mapA = new Map(pointsA.map((p) => [p.date, p.rating]));
  const mapB = new Map(pointsB.map((p) => [p.date, p.rating]));
  const meetSet = new Set(meetings.map((m) => m.date));
  const markA = x
    .filter((d) => meetSet.has(d) && mapA.has(d))
    .map((d) => ({ coord: [d, mapA.get(d)!] as [string, number] }));

  const seriesA: {
    name: string;
    type: "line";
    showSymbol: false;
    data: (number | null)[];
    markPoint?: {
      symbol: string;
      symbolSize: number;
      itemStyle: { color: string };
      data: { coord: [string, number]; name: string }[];
    };
  } = {
    name: nameA,
    type: "line",
    showSymbol: false,
    data: x.map((d) => mapA.get(d) ?? null),
  };
  if (markA.length) {
    seriesA.markPoint = {
      symbol: "diamond",
      symbolSize: 8,
      itemStyle: { color: "#C45C26" },
      data: markA.map((m) => ({ coord: m.coord, name: "同場" })),
    };
  }

  return {
    color: ["#B8860B", "#3D5A80"],
    grid: { left: 44, right: 16, top: 36, bottom: 28 },
    legend: { data: [nameA, nameB], top: 0, textStyle: { fontSize: 11 } },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: x, axisLabel: { fontSize: 10 } },
    yAxis: { type: "value", scale: true, axisLabel: { fontSize: 10 } },
    series: [
      seriesA,
      {
        name: nameB,
        type: "line",
        showSymbol: false,
        data: x.map((d) => mapB.get(d) ?? null),
      },
    ],
  };
}

export function parseOptionalDistance(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
