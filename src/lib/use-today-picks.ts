// 天喜 · 全日預測 hook：合併引擎預測（全部場次）與排位表資料（賠率、負磅、綵衣代碼）
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getTodayPicksAll } from "./picks.functions";
import { useMeetingCancellation } from "./meeting-status";
import { txApi } from "./tx-api";
import { picksEdition, editionAfterError } from "./picks-refresh";
import { identityMatchedEntry, evidenceDraw } from './racing-runner-identity';
import { useHkjcChanges, useChangeProgress } from './use-hkjc-changes';
import { changeRevision, verifiedUpdate } from './racing-change-progress';
import { liveWithdrawal } from './live-racing-changes';
import { horseDisplayName } from './horse-name';
import { freezePublicationPending } from './freeze-publication-window';

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
  const [clock, setClock] = useState(0);
  useEffect(() => {
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const queryClient = useQueryClient();
  const lastRevision = useRef<string | null>(null);
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
    // 冷啟動偶爾超時：自動再試一次，唔使會員撳掣。
    retry: 1,
    retryDelay: 3_000,
    enabled: !cancellation,
  });
  const date: string | undefined = picks.data?.date;
  const changes = useHkjcChanges(date);
  const changesSnapshot = changes.data?.race_date === date && changes.data?.venue === picks.data?.venue ? changes.data : null;
  const updates = useChangeProgress(date);
  const currentUpdate = updates.data?.find(row => row.revision === changeRevision(changesSnapshot?.changes ?? []));
  const completedAt = verifiedUpdate(currentUpdate ?? null) ? currentUpdate?.recomputed_at : null;
  useEffect(() => {
    if (!date || !completedAt) return;
    void queryClient.invalidateQueries({ queryKey:['todayPicksAll'], exact:true });
    void queryClient.invalidateQueries({ queryKey:['meeting',date], exact:true });
  }, [date,completedAt,queryClient]);
  const revision = changesSnapshot ? `${date}:${changesSnapshot.sha256}` : null;
  useEffect(() => {
    if (!date || !revision || lastRevision.current === revision) return;
    lastRevision.current = revision;
    void queryClient.invalidateQueries({ queryKey: ['meeting', date], exact: true });
    // 只刷新讀取；瀏覽器唔觸發運算，鎖後仍走原副本驗證。
    void queryClient.invalidateQueries({ queryKey: ['todayPicksAll'], exact: true });
  }, [date, revision, queryClient]);
  const generatedAt = picks.data?.generatedAt;
  useEffect(() => {
    if (date && generatedAt) void queryClient.invalidateQueries({ queryKey: ['meeting', date], exact: true });
  }, [date, generatedAt, queryClient]);
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
    for (const h of (r as { horses?: Array<{ horseNumber?: unknown }> }).horses || []) {
      entryIndex.set(`${r.raceNumber}-${h.horseNumber}`, h);
    }
  }

  const races = (picks.data?.races || []).map((r: any) => {
    const info = (meeting.data?.races || []).find((x: any) => Number(x.raceNumber) === Number(r.raceNumber));
    return {
      ...r,
      raceId: r.raceId || (date ? `race_${date}_${picks.data?.venue}_${r.raceNumber}` : ""),
      title: r.title || (info as { title?: string } | undefined)?.title || `第 ${r.raceNumber} 場`,
      startTime: (info as { startTime?: string } | undefined)?.startTime ?? r.startTime ?? null,
      picks: (r.picks || []).map((p: any): MergedPick => {
        const candidate = entryIndex.get(`${r.raceNumber}-${p.horseNumber}`);
        // Never attach another runner's draw, silks, names or connections by number alone.
        const e = (identityMatchedEntry(p.horseId, candidate) ?? {}) as { winOdds?: number | null; weight?: number | null; declaredWeight?: number | null; rating?: number | null; code?: string | null; gear?: string | null; nameCh?: string | null; name?: string | null; jockeyCh?: string | null; trainerCh?: string | null; draw?: number | null };
        return {
          ...p,
          officialChange: liveWithdrawal(changesSnapshot?.changes ?? [], Number(r.raceNumber), p, picks.data?.lockAt) ?? p.officialChange ?? null,
          winOdds: p.winOdds ?? e.winOdds ?? null,
          weight: p.weight ?? e.weight ?? null,
          declaredWeight: p.declaredWeight ?? e.declaredWeight ?? null,
          rating: p.rating ?? e.rating ?? null,
          code: e.code ?? null,
          gear: e.gear ?? null,
          nameCh: horseDisplayName(p.nameCh || e.nameCh || e.name, p.horseId),
          jockeyCh: p.jockeyCh ?? e.jockeyCh ?? null,
          trainerCh: p.trainerCh ?? e.trainerCh ?? null,
          draw: evidenceDraw(picksEdition(picks.data) === 'final', p.draw, e.draw),
        };
      }),
    };
  });

  const edition = editionAfterError(picks.data, Boolean(picks.error));
  const publicationPending = !picks.error && picks.data?.edition === 'pending' && freezePublicationPending(picks.data.lockAt, 'no-archive', clock);
  const publicationExpired = picks.data?.edition === 'pending' && clock > Date.parse(picks.data.publicationDeadline ?? '');
  return {
    date: cancellation?.date ?? date,
    venue: picks.data?.venue as string | undefined,
    trackCondition: picks.data?.trackCondition as string | undefined,
    generatedAt: picks.data?.generatedAt as string | undefined,
    frozen: edition === "final",
    edition,
    publicationPending,
    publicationDeadline: picks.data?.publicationDeadline,

    engine: (picks.data?.engine ?? picks.data?.meta ?? picks.data) as import('./racing-shapes').EngineMeta,
    races: cancellation || edition === "unavailable" ? [] : races,
    meeting: meeting.data,
    cancellation,
    isLoading: cancellation ? false : picks.isLoading,
    error: edition === "unavailable" ? picks.error ?? (publicationExpired ? new Error('凍結副本未能在首場前60分鐘完成核實') : null) : null,
    isFetching: picks.isFetching,
    refetch: picks.refetch,
    changesSnapshot,
    changesError: changes.isError,
  };
}
