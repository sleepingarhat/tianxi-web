import type { EChartsOption } from "echarts";

import type { LabH2hPayload } from "./lab-h2h.functions";

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

/** Elo 雙線＋同場日出賽標註。 */
export function buildEloOption(
  payload: Pick<LabH2hPayload, "elo" | "entities">,
): EChartsOption {
  const nameA = entityLabel(payload.entities.a);
  const nameB = entityLabel(payload.entities.b);
  const dates = new Set<string>();
  for (const p of payload.elo.a) dates.add(p.date);
  for (const p of payload.elo.b) dates.add(p.date);
  const x = [...dates].sort();
  const mapA = new Map(payload.elo.a.map((p) => [p.date, p.rating]));
  const mapB = new Map(payload.elo.b.map((p) => [p.date, p.rating]));
  const meetSet = new Set(payload.elo.meetings.map((m) => m.date));
  const markA = x
    .filter((d) => meetSet.has(d) && mapA.has(d))
    .map((d) => ({ coord: [d, mapA.get(d)!] as [string, number] }));

  return {
    color: ["#B8860B", "#3D5A80"],
    grid: { left: 44, right: 16, top: 36, bottom: 28 },
    legend: { data: [nameA, nameB], top: 0, textStyle: { fontSize: 11 } },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: x, axisLabel: { fontSize: 10 } },
    yAxis: { type: "value", scale: true, axisLabel: { fontSize: 10 } },
    series: [
      {
        name: nameA,
        type: "line",
        showSymbol: false,
        data: x.map((d) => mapA.get(d) ?? null),
        markPoint: markA.length
          ? {
              symbol: "diamond",
              symbolSize: 8,
              itemStyle: { color: "#C45C26" },
              data: markA.map((m) => ({ coord: m.coord, name: "同場" })),
            }
          : undefined,
      },
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
