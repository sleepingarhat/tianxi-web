import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AppShell } from "@/components/tx/AppShell";
import { MeetingCancellationNotice } from "@/components/tx/MeetingCancellationNotice";
import { RacingChangesNotice } from "@/components/tx/RacingChangesNotice";
import { UpgradeCard } from "@/components/tx/gates/UpgradeCard";
import { Card, Disclaimer, Empty, ErrorNote, Loading, PageHead, Pill } from "@/components/tx/ui";
import { cardAccess } from "@/lib/tier-projection";
import { useTier } from "@/lib/useTier";
import { useTodayPicks } from "@/lib/use-today-picks";
import { useWatchSet } from "@/lib/useWatchSet";
import { getMeetingHitRate } from "@/lib/hit-rate.functions";
import { cleanTime, countdown, fmtMeetingDate, pct, txApi } from "@/lib/tx-api";
import {
  actualTop4FromPicks,
  isMeetingToday,
  lockPhase,
  lockStatusLabel,
  modelMarketGapPp,
  pickFocusRace,
  rankedPicks,
  top4HitCount,
  venueLabel,
} from "@/lib/today-dashboard";
import type { VenueWeather } from "@/routes/api/public/hkjc-weather";

type WeatherResponse = { venues: VenueWeather[] };

export const Route = createFileRoute("/today")({
  head: () => ({
    meta: [
      { title: "今日賽日 · 天喜 TIANXI" },
      { name: "description", content: "賽日儀表板：鎖定狀態、而家場次四揀、全日清單、命中暫計與愛駒出賽。" },
      { property: "og:title", content: "今日賽日 · 天喜 TIANXI" },
      { property: "og:description", content: "賽日儀表板：而家場次、全日四揀與鎖定狀態。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const tier = useTier();
  const tp = useTodayPicks();
  const watch = useWatchSet();
  const hitFn = useServerFn(getMeetingHitRate);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const smart = useQuery({
    queryKey: ["smartCurrent", "today-page"],
    queryFn: () => txApi.smartCurrent(),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const nextMeeting = useQuery({
    queryKey: ["nextMeeting", "today-page"],
    queryFn: () => txApi.nextMeeting(),
    staleTime: 5 * 60_000,
    enabled: !tp.isLoading && !tp.date,
  });

  const weather = useQuery<WeatherResponse>({
    queryKey: ["hkjcWeather", "today-page"],
    queryFn: async () => {
      const response = await fetch("/api/public/hkjc-weather");
      if (!response.ok) throw new Error("天氣資料讀取失敗");
      return response.json();
    },
    refetchInterval: 60_000,
  });

  const pnl = useQuery({
    queryKey: ["strategyPnl", "today-page"],
    enabled: tier.has("pro"),
    queryFn: () => txApi.strategyPnl(),
    staleTime: 5 * 60_000,
  });

  const date = tp.date ?? smart.data?.date ?? nextMeeting.data?.date;
  const venue = tp.venue ?? smart.data?.venue ?? nextMeeting.data?.venue;
  const meetingToday = isMeetingToday(date, new Date(nowMs));
  const races = tp.races ?? [];
  const venueName =
    tp.meeting?.venueName || smart.data?.venueName || nextMeeting.data?.venueName || venueLabel(venue);
  const going = tp.trackCondition || smart.data?.trackCondition || "—";

  const venueWeather = (weather.data?.venues || []).find((item) => item.venue === venue);
  const weatherMini = venueWeather
    ? venueWeather.rain10Min != null && venueWeather.rain10Min > 0
      ? "有雨"
      : venueWeather.rainToday != null && venueWeather.rainToday > 0
        ? "曾有雨"
        : "無雨"
    : smart.data?.weather || "—";

  const lockAt = (tp.engine as { lockAt?: string } | undefined)?.lockAt ?? null;
  const phase = lockPhase({
    isLoading: tp.isLoading,
    publicationPending: tp.publicationPending,
    frozen: tp.frozen,
    edition: tp.edition,
    lockAt,
    nowMs,
  });
  const lockLabel = lockStatusLabel(phase, lockAt, nowMs);

  const focus = useMemo(
    () => pickFocusRace(races, date, nowMs),
    [races, date, nowMs],
  );
  const focusRace = focus ? races.find((r: { raceNumber: number }) => Number(r.raceNumber) === Number(focus.race.raceNumber)) : null;
  const focusAccess = focusRace ? cardAccess(tier.tier, Number(focusRace.raceNumber)) : "locked";

  const hitRate = useQuery({
    queryKey: ["meetingHitRate", "today-page", date, tier.tier],
    queryFn: () => hitFn({ data: { date: date! } }),
    enabled: !!date && meetingToday && !tp.cancellation,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const hitByRace = useMemo(() => {
    const map = new Map<number, number | null>();
    for (const r of hitRate.data?.races ?? []) {
      const n = Number(r.raceNumber);
      if (r.redacted) {
        map.set(n, null);
        continue;
      }
      if (typeof r.top4IntersectCount === "number") {
        map.set(n, r.top4IntersectCount);
        continue;
      }
      const pred = (r.predictedTop4 ?? []).map((p: { horseNumber?: number }) => ({ horseNumber: p.horseNumber }));
      const actual = (r.actualTop4 ?? []).map((a: { horseNumber?: number } | number) =>
        typeof a === "number" ? a : Number(a.horseNumber),
      );
      map.set(n, top4HitCount(pred, actual));
    }
    return map;
  }, [hitRate.data]);

  const dayHits = useMemo(() => {
    let hits = 0;
    let racesCounted = 0;
    for (const v of hitByRace.values()) {
      if (typeof v === "number") {
        hits += v;
        racesCounted += 1;
      }
    }
    // 後備：由今日 picks 嘅 finishingPosition 計（僅 full access 場）
    if (!racesCounted) {
      for (const r of races) {
        if (cardAccess(tier.tier, Number(r.raceNumber)) !== "full") continue;
        const actual = actualTop4FromPicks(r.picks);
        const n = top4HitCount(rankedPicks(r.picks, 4), actual);
        if (n != null) {
          hits += n;
          racesCounted += 1;
        }
      }
    }
    return { hits, racesCounted };
  }, [hitByRace, races, tier.tier]);

  const watchedIds = useMemo(() => new Set(watch.data?.rows.map((r) => r.horse_id) ?? []), [watch.data]);
  const watchedToday = useMemo(() => {
    const out: { raceNumber: number; horseNumber: number; nameCh?: string; horseId?: string }[] = [];
    for (const r of races) {
      for (const p of r.picks ?? []) {
        if (p.horseId && watchedIds.has(p.horseId)) {
          out.push({
            raceNumber: Number(r.raceNumber),
            horseNumber: Number(p.horseNumber),
            nameCh: p.nameCh,
            horseId: p.horseId,
          });
        }
      }
    }
    return out;
  }, [races, watchedIds]);

  const ticker = tp.cancellation
    ? `${fmtMeetingDate(tp.cancellation.date)} · ${tp.cancellation.label}`
    : date
      ? `${fmtMeetingDate(date)} · ${venueName} · ${meetingToday ? "賽日" : "下一賽日"} · ${lockLabel}`
      : "載入賽日…";

  return (
    <AppShell page="today" columns={false} wide ticker={ticker}>
      <PageHead
        en="Race day"
        title="今日"
        desc={
          meetingToday
            ? "賽日儀表板 · 鎖定狀態、而家場次、全日四揀與命中暫計（研究層資訊，唔催促投注）"
            : "非賽日顯示下一個賽日 · 資料以凍結／官方來源為準"
        }
      />

      {tp.cancellation ? <MeetingCancellationNotice cancellation={tp.cancellation} /> : null}
      <RacingChangesNotice snapshot={tp.changesSnapshot} failed={tp.changesError} />

      <section className="mx-4 mt-3 flex flex-wrap items-center gap-1.5 border-b border-hairline pb-3">
        <Pill tone="gold">{date ? fmtMeetingDate(date) : "日期待定"}</Pill>
        <Pill>{venueName}</Pill>
        <Pill>地況 {going}</Pill>
        <Pill>天氣 {weatherMini}</Pill>
        <Pill tone={phase === "locked" ? "win" : phase === "unavailable" ? "lose" : "gold"}>{lockLabel}</Pill>
        {!meetingToday && date ? <Pill tone="ink">非今日 · 顯示下一賽日</Pill> : null}
      </section>

      {tp.cancellation ? null : tp.isLoading || tier.loading ? (
        <Loading label="核對賽日預測中…" />
      ) : tp.error ? (
        <div className="mx-4 my-4 space-y-3">
          <p role="alert" className="text-[12px] text-ink-2">
            預測暫未能核實；原凍結紀錄不變，稍後會自動重新核對。
          </p>
          <ErrorNote error={tp.error} />
          <button
            type="button"
            className="rounded-full border border-hairline px-3 py-1.5 text-[12px] font-bold"
            disabled={tp.isFetching}
            onClick={() => void tp.refetch()}
          >
            {tp.isFetching ? "正在重新核對…" : "重新核對"}
          </button>
        </div>
      ) : tp.publicationPending ? (
        <Card title="正在建立凍結副本" en="Freeze publication">
          <p className="text-[12px] leading-relaxed text-ink-2">
            原四揀已停止更新；副本核實後會自動顯示。倒數只係資訊，唔催促操作。
          </p>
          <Loading label="正在建立凍結副本…" />
        </Card>
      ) : !races.length ? (
        <Empty label={date ? "此賽日尚無預測" : "暫未有賽日資料"} />
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-2">
          <div className="min-w-0">
            <NowCard
              focusKind={focus?.kind ?? "next"}
              race={focusRace}
              access={focusAccess}
              tierLoading={tier.loading}
              meetingDate={date}
              nowMs={nowMs}
              needUpgrade={focusAccess !== "full"}
            />

            <Card title="全日場次" en="All races" action={<Link to="/cards" className="text-[11px] font-bold text-gold">逐場預測 →</Link>}>
              <ul className="divide-y divide-hairline">
                {races.map((r: any) => {
                  const access = cardAccess(tier.tier, Number(r.raceNumber));
                  const start = cleanTime(r.startTime);
                  const top = rankedPicks(r.picks, 4);
                  const hit = hitByRace.get(Number(r.raceNumber));
                  const finished = r.settled === true || r.hasResult === true || hit != null;
                  const status =
                    finished ? "完場" : start && countdown(r.startTime, new Date(nowMs), date) === "已開跑" ? "進行中" : "待開";
                  return (
                    <li key={r.raceNumber} className="py-2.5">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <b className="font-serif-tc text-[14px]">第 {r.raceNumber} 場</b>
                        <span className="tabnum font-mono-tx text-[11px] text-ink-3">{start || "時間待定"}</span>
                        <span className="text-[11px] text-ink-3">
                          {r.className || r.class || "—"} · {r.distance || r.distanceM || "—"}
                          {r.distance || r.distanceM ? "m" : ""}
                        </span>
                        <Pill tone={status === "完場" ? "ink" : status === "進行中" ? "gold" : "ink"}>{status}</Pill>
                        {typeof hit === "number" ? <Pill tone="win">命中 {hit}/4</Pill> : null}
                      </div>
                      {access === "full" ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {top.map((p) => (
                            <span
                              key={p.horseNumber}
                              className="tabnum rounded-[4px] border border-hairline bg-paper px-1.5 py-0.5 font-mono-tx text-[10px] font-bold text-ink"
                            >
                              #{p.horseNumber} {p.nameCh || ""}
                            </span>
                          ))}
                          {!top.length ? <span className="text-[11px] text-ink-3">等臨場盤口／預測</span> : null}
                        </div>
                      ) : access === "name" ? (
                        <div className="mt-1.5">
                          <p className="font-serif-tc text-[13px] font-bold">{r.picks?.[0]?.nameCh || "首選待定"}</p>
                          {!tier.loading ? <UpgradeCard inline need="pro" feature="全日逐場預測" /> : null}
                        </div>
                      ) : (
                        <div className="mt-1.5">{!tier.loading ? <UpgradeCard inline need="registered" feature="其他場次首選" /> : null}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>

          <aside className="min-w-0 lg:sticky lg:top-[72px] lg:pb-6">
            <Card title="今日累計命中" en="Day hits">
              {dayHits.racesCounted ? (
                <p className="tabnum font-mono-tx text-[22px] font-bold text-ink">
                  {dayHits.hits}
                  <span className="ml-1 text-[12px] font-medium text-ink-3">／{dayHits.racesCounted * 4} 匹位</span>
                </p>
              ) : (
                <p className="text-[12px] text-ink-3">完場並核實後顯示；未完場唔預估。</p>
              )}
              <p className="mt-1 text-[10px] leading-relaxed text-ink-3">正式凍結／戰績起計 2026-10-04 · 研究層統計</p>
            </Card>

            <Card title="策略盈虧暫計" en="Strategy PnL" action={<Link to="/strategy-pnl" className="text-[11px] font-bold text-gold">詳情 →</Link>}>
              {!tier.has("pro") ? (
                <UpgradeCard inline need="pro" feature="策略盈虧" />
              ) : pnl.isLoading ? (
                <Loading label="讀取盈虧…" />
              ) : pnl.isError ? (
                <p className="text-[12px] text-ink-3">暫時未能讀取策略盈虧</p>
              ) : (() => {
                const points = Array.isArray(pnl.data?.points) ? pnl.data.points : [];
                const totalNet = points.reduce(
                  (a: number, row: { cost?: number; payout?: number }) =>
                    a + (Number(row.payout) || 0) - (Number(row.cost) || 0),
                  0,
                );
                return (
                  <>
                    <p
                      className={`tabnum font-mono-tx text-[20px] font-bold ${
                        totalNet >= 0 ? "text-win" : "text-lose"
                      }`}
                    >
                      {totalNet >= 0 ? "+" : "−"}
                      {Math.abs(totalNet).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                    </p>
                    <p className="mt-1 text-[10px] text-ink-3">
                      起計 {pnl.data?.from ? fmtMeetingDate(pnl.data.from) : "—"} · 單場彩池暫計（未含孖T／三T）· 非投資建議
                    </p>
                  </>
                );
              })()}
            </Card>

            <Card title="愛駒今日出賽" en="Watched runners" action={<Link to="/my-horses" className="text-[11px] font-bold text-gold">愛駒 →</Link>}>
              {watch.signedIn !== true ? (
                <p className="text-[12px] text-ink-3">
                  <Link to="/auth" search={{ next: "/today" }} className="font-bold text-gold">
                    登入
                  </Link>
                  後顯示你追蹤嘅馬今日有冇出賽。
                </p>
              ) : !watchedToday.length ? (
                <p className="text-[12px] text-ink-3">今日愛駒未有出賽（或以你可見場次為準）。</p>
              ) : (
                <ul className="divide-y divide-hairline">
                  {watchedToday.map((w) => (
                    <li key={`${w.raceNumber}-${w.horseId}`} className="flex items-center justify-between gap-2 py-1.5 text-[12px]">
                      <span>
                        第 {w.raceNumber} 場 · #{w.horseNumber}{" "}
                        {w.horseId ? (
                          <Link to="/horse" search={{ id: w.horseId }} className="font-serif-tc font-bold text-ink">
                            {w.nameCh || w.horseId}
                          </Link>
                        ) : (
                          <b className="font-serif-tc">{w.nameCh}</b>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </aside>
        </div>
      )}

      <Disclaimer />
    </AppShell>
  );
}

function NowCard({
  focusKind,
  race,
  access,
  tierLoading,
  meetingDate,
  nowMs,
  needUpgrade,
}: {
  focusKind: "current" | "next" | "last";
  race: any;
  access: "full" | "name" | "locked";
  tierLoading: boolean;
  meetingDate?: string | undefined;
  nowMs: number;
  needUpgrade: boolean;
}) {
  if (!race) {
    return (
      <Card title="而家" en="Now">
        <p className="text-[12px] text-ink-3">暫未有場次焦點</p>
      </Card>
    );
  }
  const kindLabel = focusKind === "current" ? "當前場" : focusKind === "next" ? "下一場" : "最近一場";
  const start = cleanTime(race.startTime);
  const cd = countdown(race.startTime, new Date(nowMs), meetingDate);
  const top = rankedPicks(race.picks, 5);
  const top4 = top.slice(0, 4);
  const fifth = top[4];
  const gap = access === "full" && top4[0] ? modelMarketGapPp(top4[0], race.picks) : null;
  const oddsAt = race.oddsSnapshotAt
    ? new Date(race.oddsSnapshotAt).toLocaleString("zh-HK", {
        timeZone: "Asia/Hong_Kong",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : null;

  return (
    <Card
      title={`而家 · ${kindLabel} 第 ${race.raceNumber} 場`}
      en="Focus race"
      action={
        race.raceId ? (
          <Link to="/race" search={{ id: race.raceId }} className="text-[11px] font-bold text-gold">
            排位表 →
          </Link>
        ) : null
      }
    >
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-3">開跑倒數</p>
          <p className="tabnum font-mono-tx text-[28px] font-bold leading-none text-ink">{cd || "—"}</p>
          <p className="mt-1 text-[11px] text-ink-3">{start ? `${start} HKT` : "時間待定"} · 資訊用，唔催促</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Pill>{race.className || race.class || "班次—"}</Pill>
          <Pill>{race.distance || race.distanceM ? `${race.distance || race.distanceM}m` : "途程—"}</Pill>
          {race.going ? <Pill>{race.going}</Pill> : null}
        </div>
      </div>

      {access === "full" ? (
        <>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {top4.map((p, i) => (
              <span
                key={p.horseNumber}
                className={`rounded-[6px] border px-2 py-1 ${i === 0 ? "border-gold-strong/50 bg-gold-bg" : "border-hairline bg-paper"}`}
              >
                <span className="tabnum font-mono-tx text-[11px] font-bold">#{p.horseNumber}</span>{" "}
                <span className="font-serif-tc text-[12px] font-bold">{p.nameCh || "—"}</span>
                <span className="ml-1 tabnum font-mono-tx text-[10px] text-ink-3">{pct(p.pWin)}</span>
              </span>
            ))}
            {fifth ? (
              <span className="rounded-[6px] border border-dashed border-hairline px-2 py-1 text-[11px] text-ink-2">
                第五選 #{fifth.horseNumber} {fifth.nameCh || ""}
              </span>
            ) : null}
          </div>
          <p className="text-[11px] leading-relaxed text-ink-2">
            首選模型 vs 市場：
            {gap == null ? (
              <span className="text-ink-3"> 等臨場盤口</span>
            ) : (
              <b className={`tabnum ml-1 font-mono-tx ${gap >= 0 ? "text-win" : "text-lose"}`}>
                {gap >= 0 ? "+" : ""}
                {gap.toFixed(1)} pp
              </b>
            )}
            {oddsAt ? <span className="ml-2 text-ink-3">賠率快照 {oddsAt}</span> : null}
          </p>
        </>
      ) : access === "name" ? (
        <div>
          <p className="font-serif-tc text-[16px] font-bold">{race.picks?.[0]?.nameCh || "首選待定"}</p>
          {!tierLoading && needUpgrade ? <UpgradeCard inline need="pro" feature="全日逐場預測" /> : null}
        </div>
      ) : (
        <div>{!tierLoading && needUpgrade ? <UpgradeCard inline need="registered" feature="其他場次首選" /> : null}</div>
      )}
    </Card>
  );
}
