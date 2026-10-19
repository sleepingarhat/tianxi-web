// 天喜 · 少仗提示：逐場數出四揀之中第一／二次出賽嘅馬匹
// 純展示層：只補資料提示，不影響正式資格、分數或排名，唔重訓。
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getHorseStarts } from "./horse-starts.functions";
import { SCARCE_START_THRESHOLD } from "./prediction-status";

/** 每場取四揀（rank 1–4）嘅 horseId */
function top4Ids(races: any[]): { byRace: Record<number, string[]>; ids: string[] } {
  const byRace: Record<number, string[]> = {};
  const ids: string[] = [];
  for (const r of races || []) {
    const picks = (r?.picks || [])
      .slice()
      .sort((a: any, b: any) => (a?.rank ?? 99) - (b?.rank ?? 99))
      .slice(0, 4);
    const list = picks.map((p: any) => String(p?.horseId || "")).filter(Boolean);
    byRace[Number(r?.raceNumber)] = list;
    ids.push(...list);
  }
  return { byRace, ids };
}

export function useScarceStarts(races: any[], date?: string) {
  const { byRace, ids } = top4Ids(races);
  const fetchStarts = useServerFn(getHorseStarts);
  const q = useQuery({
    queryKey: ["horseStarts", date ?? "latest", ids.join(",")],
    queryFn: () => fetchStarts({ data: { ids } }),
    enabled: ids.length > 0,
    staleTime: 30 * 60_000,
  });

  const starts = q.data?.starts ?? {};
  const scarceByRace: Record<number, number> = {};
  for (const [raceNo, list] of Object.entries(byRace)) {
    scarceByRace[Number(raceNo)] = list.filter((id) => {
      const n = starts[id];
      return typeof n === "number" && n <= SCARCE_START_THRESHOLD;
    }).length;
  }
  return { scarceByRace, starts, isLoading: q.isLoading };
}
