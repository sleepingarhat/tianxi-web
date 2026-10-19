// 天喜 · 全日預測 hook：合併引擎預測（全部場次）與排位表資料（賠率、負磅、綵衣代碼）
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getTodayPicksAll } from "./picks.functions";
import { useMeetingCancellation } from "./meeting-status";
import { txApi } from "./tx-api";
import { picksEdition } from "./picks-refresh";
import { identityMatchedEntry, evidenceDraw } from './racing-runner-identity';
import { useHkjcChanges } from './use-hkjc-changes';
import { liveWithdrawal } from './live-racing-changes';

export type MergedPick = {
  horseNumber: number;
  nameCh?: string;
  nameEn?: string;
  jockeyCh?: string | null;
  trainerCh?: string | null;
  draw?: number | null;
  pWin?: number | null;
  pTop3?: number | null;
  pTop4?: number | null;
  rank?: number;
  horseId?: string;
  winOdds?: number | null;
  weight?: number | null;
  declaredWeight?: number | null;
  rating?: number | null;
  code?: string | null;
  gear?: string | null;
};

export function useTodayPicks() {
  // 引擎自動偵測停賽（人手覆寫 → 馬會公告 → 賽日結構）
  const { cancellation } = useMeetingCancellation();
  const fetchAll = useServerFn(getTodayPicksAll);
  const picks = useQuery({
    queryKey: ["todayPicksAll"],
    queryFn: () => fetchAll(),
    staleTime: 60_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: "always",
    refetchOnMount: "always",
    retry: false,
    enabled: !cancellation,
  });
  const date: string | undefined = picks.data?.date;
  const changes = useHkjcChanges(date);
  const changesSnapshot = changes.data?.race_date === date && changes.data?.venue === picks.data?.venue ? changes.data : null;
  const meeting = useQuery({
    queryKey: ["meeting", date],
    queryFn: () => {
      if (!date) throw new Error("未有賽日日期");
      return txApi.meeting(date);
    },
    enabled: !!date && !cancellation,
    refetchInterval: 60_000,
  });

  const entryIndex = new Map<string, any>();
  for (const r of meeting.data?.races || []) {
    for (const h of (r as any).horses || []) {
      entryIndex.set(`${r.raceNumber}-${h.horseNumber}`, h);
    }
  }

  const races = (picks.data?.races || []).map((r: any) => {
    const info = (meeting.data?.races || []).find((x: any) => Number(x.raceNumber) === Number(r.raceNumber));
    return {
      ...r,
      raceId: r.raceId || (date ? `race_${date}_${picks.data.venue}_${r.raceNumber}` : ""),
      title: r.title || (info as any)?.title || `第 ${r.raceNumber} 場`,
      startTime: (info as any)?.startTime ?? r.startTime ?? null,
      picks: (r.picks || []).map((p: any): MergedPick => {
        const candidate = entryIndex.get(`${r.raceNumber}-${p.horseNumber}`);
        // Never attach another runner's draw, silks, names or connections by number alone.
        const e = identityMatchedEntry(p.horseId, candidate) as any ?? {};
        return {
          ...p,
          officialChange: liveWithdrawal(changesSnapshot?.changes ?? [], Number(r.raceNumber), p, picks.data?.lockAt) ?? p.officialChange ?? null,
          winOdds: p.winOdds ?? e.winOdds ?? null,
          weight: p.weight ?? e.weight ?? null,
          declaredWeight: p.declaredWeight ?? e.declaredWeight ?? null,
          rating: p.rating ?? e.rating ?? null,
          code: e.code ?? null,
          gear: e.gear ?? null,
          nameCh: p.nameCh || e.nameCh || e.name,
          jockeyCh: p.jockeyCh ?? e.jockeyCh ?? null,
          trainerCh: p.trainerCh ?? e.trainerCh ?? null,
          draw: evidenceDraw(picksEdition(picks.data) === 'final', p.draw, e.draw),
        };
      }),
    };
  });

  const edition = picks.error ? "unavailable" : picksEdition(picks.data);
  return {
    date: cancellation?.date ?? date,
    venue: picks.data?.venue as string | undefined,
    trackCondition: picks.data?.trackCondition as string | undefined,
    generatedAt: picks.data?.generatedAt as string | undefined,
    frozen: edition === "final",
    edition,

    engine: (picks.data?.engine ?? picks.data?.meta ?? picks.data) as any,
    races: cancellation || edition === "unavailable" ? [] : races,
    meeting: meeting.data,
    cancellation,
    isLoading: cancellation ? false : picks.isLoading,
    error: picks.error,
    changesSnapshot,
    changesError: changes.isError,
  };
}
