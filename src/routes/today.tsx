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
import { getRaceDayCardDisplay } from "@/lib/race-day-card.functions";
import { cleanTime, countdown, fmtMeetingDate, pct, txApi } from "@/lib/tx-api";
import {
  classDistanceLine,
  DAY_HITS_EMPTY,
  DAY_HITS_PARTIAL,
  displayedRaceHit,
  distanceText,
  focusRaceHeading,
  goingPill,
  goingText,
  isMeetingToday,
  lockPhase,
  lockStatusLabel,
  modelMarketGapPp,
  pickFocusRace,
  positiveDistance,
  PRELIMINARY_UNLOCKED_LABEL,
  RACE_DAY_PAGE_TITLE,
  raceRunStatus,
  rankedPicks,
  showPreliminaryUnlocked,
  STRATEGY_PNL_CARD_TITLE,
  STRATEGY_PNL_NOTE,
  sumVerifiedHits,
  venueLabel,
} from "@/lib/today-dashboard";
import type { VenueWeather } from "@/routes/api/public/hkjc-weather";

type WeatherResponse = { venues: VenueWeather[] };

export const Route = createFileRoute("/today")({
  head: () => ({
    meta: [
      { title: "賽日 · 天喜 TIANXI" },
      { name: "description", content: "賽日儀表板：鎖定狀態、而家場次四揀、全日清單、逐場命中與愛駒出賽。" },
      { property: "og:title", content: "賽日 · 天喜 TIANXI" },
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
  const cardFn = useServerFn(getRaceDayCardDisplay);
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
  const storedGoing = goingText(tp.trackCondition) || goingText(smart.data?.trackCondition);

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

  const missingDistance = useMemo(
    () => races.filter((r) => positiveDistance(r) == null).map((r) => Number(r.raceNumber)),
    [races],
  );
  const racesHaveGoing = races.some((r) => goingText(r.going));
  const needCardDisplay = !!date && (venue === "ST" || venue === "HV") && (missingDistance.length > 0 || (!storedGoing && !racesHaveGoing));
  const cardDisplay = useQuery({
    queryKey: ["raceDayCardDisplay", date, venue, missingDistance.join(","), !storedGoing && !racesHaveGoing],
    queryFn: () => cardFn({
      data: {
        date: date!,
        venue: venue as "ST" | "HV",
        raceNumbers: missingDistance,
        needGoing: !storedGoing && !racesHaveGoing,
      },
    }),
    enabled: needCardDisplay && !tp.cancellation,
    staleTime: 10 * 60_000,
  });
  const cardByRace = useMemo(() => {
    const map = new Map<number, { distance: number | null; going: string | null }>();
    for (const row of cardDisplay.data?.races ?? []) map.set(Number(row.raceNumber), row);
    return map;
  }, [cardDisplay.data]);
  const going = storedGoing || goingText(cardDisplay.data?.meetingGoing) || null;

  const hitByRace = useMemo(() => {
    const map = new Map<number, { count: number | null; redacted: boolean }>();
    for (const r of hitRate.data?.races ?? []) {
      const n = Number(r.raceNumber);
      if (r.redacted) {
        map.set(n, { count: null, redacted: true });
        continue;
      }
      if (typeof r.top4IntersectCount === "number") {
        map.set(n, { count: r.top4IntersectCount, redacted: false });
        continue;
      }
      map.set(n, { count: null, redacted: false });
    }
    return map;
  }, [hitRate.data]);

  const raceHit = (race: { raceNumber?: number; verifiedHitCount?: number | null }) => {
    const row = hitByRace.get(Number(race.raceNumber));
    return displayedRaceHit({
      redactedByHitRate: row?.redacted === true,
      hitRateCount: row ? row.count : undefined,
      verifiedHitCount: race.verifiedHitCount,
    });
  };

  const dayHits = useMemo(
    () => sumVerifiedHits(races.map((race) => {
      const row = hitByRace.get(Number(race.raceNumber));
      return displayedRaceHit({
        redactedByHitRate: row?.redacted === true,
        hitRateCount: row ? row.count : undefined,
        verifiedHitCount: race.verifiedHitCount,
      });
    })),
    [hitByRace, races],
  );

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
        title={RACE_DAY_PAGE_TITLE}
        desc={
          meetingToday
            ? "賽日儀表板 · 鎖定狀態、而家場次、全日四揀與逐場命中。"
            : "非賽日顯示下一個賽日 · 資料以凍結／官方來源為準"
        }
      />

      {tp.cancellation ? <MeetingCancellationNotice cancellation={tp.cancellation} /> : null}
      <RacingChangesNotice snapshot={tp.changesSnapshot} failed={tp.changesError} />

      <section className="mx-4 mt-3 flex flex-wrap items-center gap-1.5 border-b border-hairline pb-3">
        <Pill tone="gold">{date ? fmtMeetingDate(date) : "日期待定"}</Pill>
        <Pill>{venueName}</Pill>
        <Pill>{goingPill(going)}</Pill>
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
            原四揀已停止更新；副本核實後會自動顯示。
          </p>
          <Loading label="正在建立凍結副本…" />
        </Card>
      ) : !races.length ? (
        <Empty label={date ? "此賽日尚無預測" : "暫未有賽日資料"} />
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-2">
          <div className="min-w-0">
            <NowCard
              race={focusRace}
              access={focusAccess}
              tierLoading={tier.loading}
              meetingDate={date}
              venueName={venueName}
              nowMs={nowMs}
              needUpgrade={focusAccess !== "full"}
              distanceM={focusRace ? positiveDistance(focusRace) ?? cardByRace.get(Number(focusRace.raceNumber))?.distance ?? null : null}
              goingLabel={focusRace ? goingText(focusRace.going) || goingText(cardByRace.get(Number(focusRace.raceNumber))?.going) || going : null}
            />

            <Card title="全日場次" en="All races" action={<Link to="/cards" className="text-[11px] font-bold text-gold">逐場預測 →</Link>}>
              <ul className="divide-y divide-hairline">
                {races.map((r: any) => {
                  const access = cardAccess(tier.tier, Number(r.raceNumber));
                  const start = cleanTime(r.startTime);
                  const top = rankedPicks(r.picks, 4);
                  const hit = raceHit(r);
                  const status = raceRunStatus({
                    settled: r.settled === true,
                    hasResult: r.hasResult === true,
                    hitCount: hit,
                    countdownLabel: start ? countdown(r.startTime, new Date(nowMs), date) : "",
                  });
                  const meters = positiveDistance(r) ?? cardByRace.get(Number(r.raceNumber))?.distance ?? null;
                  return (
                    <li key={r.raceNumber} className="py-2.5">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <b className="font-serif-tc text-[14px]">第 {r.raceNumber} 場</b>
                        <span className="tabnum font-mono-tx text-[11px] text-ink-3">{start || "時間待定"}</span>
                        <span className="text-[11px] text-ink-3">{classDistanceLine(r.className || r.class, meters)}</span>
                        <Pill tone={status === "完場" ? "ink" : status === "進行中" ? "gold" : "ink"}>{status}</Pill>
                        {showPreliminaryUnlocked(phase, status) ? <Pill tone="gold">{PRELIMINARY_UNLOCKED_LABEL}</Pill> : null}
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
                <>
                  <p className="tabnum font-mono-tx text-[22px] font-bold text-ink">
                    {dayHits.hits}
                    <span className="ml-1 text-[12px] font-medium text-ink-3">／{dayHits.racesCounted * 4} 匹位</span>
                  </p>
                  <p className="mt-1 text-[11px] text-ink-3">已核實 {dayHits.racesCounted} 場 · {DAY_HITS_PARTIAL}</p>
                </>
              ) : (
                <p className="text-[12px] text-ink-3">{DAY_HITS_EMPTY}</p>
              )}
              <p className="mt-1 text-[10px] leading-relaxed text-ink-3">正式凍結／戰績起計 2026-10-04 · 研究層統計</p>
            </Card>

            <Card title={STRATEGY_PNL_CARD_TITLE} en="Cumulative PnL" action={<Link to="/strategy-pnl" className="text-[11px] font-bold text-gold">詳情 →</Link>}>
              {!tier.has("pro") ? (
                <UpgradeCard inline need="pro" feature="策略累計盈虧" />
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
                      起計 {pnl.data?.from ? fmtMeetingDate(pnl.data.from) : "—"} · {STRATEGY_PNL_NOTE}
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
  race,
  access,
  tierLoading,
  meetingDate,
  venueName,
  nowMs,
  needUpgrade,
  distanceM,
  goingLabel,
}: {
  race: any;
  access: "full" | "name" | "locked";
  tierLoading: boolean;
  meetingDate?: string | undefined;
  venueName?: string | null;
  nowMs: number;
  needUpgrade: boolean;
  distanceM: number | null;
  goingLabel: string | null;
}) {
  if (!race) {
    return (
      <Card title="而家" en="Now">
        <p className="text-[12px] text-ink-3">暫未有場次焦點</p>
      </Card>
    );
  }
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
      title={focusRaceHeading({ date: meetingDate, startTime: race.startTime, venueName })}
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
          <p className="mt-1 text-[11px] text-ink-3">{start ? `${start} HKT` : "時間待定"}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Pill>{race.className || race.class || "班次待公布"}</Pill>
          <Pill>{distanceText(distanceM)}</Pill>
          <Pill>{goingPill(goingLabel)}</Pill>
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
