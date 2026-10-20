import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PredictorComparison } from "@/components/tx/PredictorComparison";
import { PredictorEnginePicks } from "@/components/tx/PredictorEnginePicks";

import { AppShell } from "@/components/tx/AppShell";
import { MeetingCancellationNotice } from "@/components/tx/MeetingCancellationNotice";
import { PredictionStatusLight } from "@/components/tx/PredictionStatusLight";
import { RacecoursePhoto } from "@/components/tx/RacecoursePhoto";
import { WeatherPanel } from "@/components/tx/WeatherPanel";
import { RacePositionMap } from "@/components/tx/RacePositionMap";
import { LivePickEvidence } from "@/components/tx/LivePickEvidence";
import { ModelVsMarketDumbbell } from "@/components/tx/ModelVsMarketDumbbell";
import { HorseExplainChip } from "@/components/tx/HorseExplainChip";
import { Card, Disclaimer, Empty, Loading, PageHead, Pill } from "@/components/tx/ui";
import { getFeatureRace, listFeatureRaces } from "@/lib/features.functions";
import { meetingLockMinutes, raceStatus } from "@/lib/prediction-status";
import { useScarceStarts } from "@/lib/use-scarce-starts";
import { FEATURE_MAP, type FeatureId, type Horse } from "@/lib/race-data";
import { cleanTime, countdown, fmtMeetingDate, pct, txApi } from "@/lib/tx-api";
import { useTodayPicks } from "@/lib/use-today-picks";
import { effectiveTop4 } from "@/lib/withdrawal-substitution";
import { RacingChangesNotice } from "@/components/tx/RacingChangesNotice";
import { racingClassLabel } from "@/lib/racing-class";



export const Route = createFileRoute("/predictor")({
  head: () => ({
    meta: [
      { title: "選馬神器 · 天喜 TIANXI" },
      { name: "description", content: "逐場引擎首選、勝算機率、賠率對照與可自選特徵的綜合排序工具。" },
      { property: "og:title", content: "選馬神器 · 天喜 TIANXI" },
      { property: "og:description", content: "逐場引擎首選與自選特徵綜合排序。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PredictorPage,
});

function PredictorPage() {
  const [raceNo, setRaceNo] = useState(1);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const tp = useTodayPicks();

  // 鎖點狀態：首場開跑前 90 分鐘鎖死全日四揀（只作展示，唔改任何預測數值）
  const lockQ = useQuery({
    queryKey: ["lockState"],
    queryFn: async () => {
      const res = await fetch("/api/public/lock-state");
      if (!res.ok) return null;
      return (await res.json()) as { lockAt?: string | null; locked?: boolean } | null;
    },
    refetchInterval: 120_000,
  });
  const lockClock = (() => {
    const iso = lockQ.data?.lockAt;
    if (!iso) return null;
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) return null;
    const hk = new Date(t.getTime() + 8 * 3600_000).toISOString();
    return `${hk.substring(11, 16)}`;
  })();

  const races = tp.races;
  const race = races.find((r: any) => Number(r.raceNumber) === raceNo) || races[0];
  const start = cleanTime(race?.startTime);
  const venueName = tp.meeting?.venueName || (tp.venue === "HV" ? "跑馬地" : tp.venue === "ST" ? "沙田" : tp.venue || "");

  // 市場參考：獨贏賠率每 20 秒重新拉取（唔固定用某日快照），並顯示盤口更新時間。
  const oddsQ = useQuery({
    queryKey: ["odds", tp.date, tp.venue, race?.raceNumber],
    queryFn: () => {
      if (!tp.date || !tp.venue || !race) return null;
      return txApi.odds(tp.date, tp.venue, Number(race.raceNumber)).catch(() => null);
    },
    enabled: !!tp.date && !!tp.venue && !!race?.raceNumber,
    retry: 2,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
  const winOddsMap: Record<string, number> = oddsQ.data?.winOdds || {};
  const liveOdds = (n: unknown) => {
    const v = winOddsMap[String(n).padStart(2, "0")];
    return typeof v === "number" ? v : null;
  };
  // 盤口時效：後端 snapshotAt（UTC）→ 港時間 HH:MM，話畀用家知個盤幾時更新。
  const oddsClock = (() => {
    const iso = (oddsQ.data as import('@/lib/racing-shapes').OddsSnapshot | undefined)?.snapshotAt;
    if (!iso) return null;
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) return null;
    return new Date(t.getTime() + 8 * 3600_000).toISOString().substring(11, 16);
  })();
  const oddsNote = oddsClock
    ? `盤口${(oddsQ.data as import('@/lib/racing-shapes').OddsSnapshot | undefined)?.live ? "即時" : "快照"}更新 ${oddsClock}（HKT）· 每 20 秒自動重取`
    : null;

  const dayLockMinutes = meetingLockMinutes(races);
  const scarce = useScarceStarts(races, tp.date);
  const raceLight = race
    ? raceStatus(race, {
        ...(tp.date ? { date: tp.date } : {}),
        now,
        lockMinutes: dayLockMinutes,
        frozen: tp.frozen,
        scarceStarts: scarce.scarceByRace[Number(race.raceNumber)] ?? 0,
      })
    : null;
  const locked = tp.frozen;

  const picks: any[] = race?.picks || [];
  const withOdds = picks.map((p) => {
    const od =
      liveOdds(p.horseNumber) ??
      (typeof p.winOdds === "number" ? p.winOdds : typeof p.liveWinOdds === "number" ? p.liveWinOdds : null);
    const implied = od && od > 0 ? 1 / od : null;
    const edge = implied != null && p.pWin != null ? p.pWin - implied : null;
    return { ...p, od, implied, edge };
  });
  const sub = effectiveTop4(withOdds.map((p) => ({ horseNumber: p.horseNumber, rank: p.rank ?? 99, withdrawn: !!p.officialChange, announcedAtIso: p.officialChange?.announcedAtIso })), tp.engine?.lockAt);
  const invalidInput = sub.status !== "valid";
  const modelCol = withOdds.slice().sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)).slice(0, 5);
  const marketCol = withOdds
    .filter((p) => p.od != null && !p.officialChange)
    .sort((a, b) => (a.od as number) - (b.od as number))
    .slice(0, 5);
  const cov = race?.expectedBoxCoverage;

  // 逐匹解釋：借用特徵排序引擎（該場之前嘅歷史資料）計出邊幾項推高／拉低
  const listFn = useServerFn(listFeatureRaces);
  const raceFn = useServerFn(getFeatureRace);
  const featList = useQuery({
    queryKey: ["whyFeatureRaces", tp.date ?? "latest"],
    queryFn: () => listFn({ data: tp.date ? { date: tp.date } : {} }),
    enabled: !!tp.date,
  });
  const featRaceId =
    (featList.data?.races ?? []).find((r: any) => Number(r.raceNumber) === Number(race?.raceNumber))?.id ?? null;
  const featRace = useQuery({
    queryKey: ["whyFeatureRace", featRaceId],
    queryFn: () => {
      if (!featRaceId) throw new Error("未有場次資料");
      return raceFn({ data: { raceId: featRaceId } });
    },
    enabled: !!featRaceId,
  });
  const featHorses = featRace.data?.horses ?? [];
  const evidenceIds: FeatureId[] = ["distance", "draw", "jt", "time", "finish", "form"];
  const evidence = evidenceIds.map((id) => {
    const ranked = (featHorses as Horse[])
      .filter((h) => h.stats?.[id])
      .slice()
      .sort((a, b) => (b.stats[id]?.score ?? 0) - (a.stats[id]?.score ?? 0));
    const leader = ranked[0];
    return { id, label: FEATURE_MAP[id].shortLabel, leader, stat: leader?.stats[id] };
  });

  if (tp.cancellation) {
    return (
      <AppShell columns={false} page="predictor" ticker={`${fmtMeetingDate(tp.cancellation.date)} · ${tp.cancellation.label}`}>
        <PageHead
          en="Predictor"
          title="選馬神器"
          desc="今日不提供預測；恢復賽事後，四揀會按既定鎖點重新提供。"
        />
        <MeetingCancellationNotice cancellation={tp.cancellation} />
        <Disclaimer />
      </AppShell>
    );
  }


  return (
    <AppShell columns={false}
      page="predictor"
      ticker={
        tp.date
          ? `${fmtMeetingDate(tp.date)} · ${venueName} · ${races.length} 場${
              start ? ` · R${raceNo} 倒數 ${countdown(start, now, tp.date)}` : ""
            }`
          : "載入中…"
      }
    >
      <PageHead
        en="Predictor"
        title="選馬神器"
        desc="先睇四揀結論，再逐層核對同程、檔位、騎練、時間、末段與近況證據；市場賠率只作對照，不會改動引擎排名。"
      />
      {venueName ? <RacecoursePhoto venue={tp.venue || venueName} /> : null}
      <RacingChangesNotice snapshot={tp.changesSnapshot} failed={tp.changesError} />

      {tp.frozen && tp.engine?.probabilityEvidence?.pTop4 === "not-saved-in-original" ? <p className="mx-4 mt-3 text-[11px] text-ink-3">原始凍結副本未保存入頭四機率；入場機率及排名暫列「—」，不以臨場估值補寫。</p> : null}

      <div className="mx-4 mt-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono-tx text-[9px] font-bold uppercase tracking-[0.14em] ${
              tp.frozen
                ? "border-gold-strong bg-gold-bg text-gold"
                : "border-hairline bg-paper text-ink-3"
            }`}
          >
            {tp.isLoading ? "核對預測中…" : tp.edition === "unavailable" ? "最終預測暫未能核實" : tp.frozen ? "最終版 · 已鎖" : "初版 · 未鎖"}
          </span>
          <span className="text-[10px] leading-snug text-ink-3">
            {tp.isLoading ? "" : tp.edition === "unavailable" ? "暫停展示預測，正在重新核對；請勿使用舊初版製作海報。" : tp.frozen
              ? "已鎖定四揀，同對賬、賽果頁用同一套，唔會再改。"
              : `未鎖定：刷新有機會改四揀；${
                  lockClock ? `${lockClock}（首場開跑前 90 分鐘）自動鎖死全日` : "首場開跑前 90 分鐘自動鎖死全日"
                }，只有鎖定後嘅最終版會入戰績。`}
          </span>
        </div>

        <p className="mb-1.5 font-mono-tx text-[9px] font-bold uppercase tracking-[0.18em] text-ink-3">全日場次</p>
        <div className="no-scrollbar flex gap-1 overflow-x-auto pb-1">
          {races.map((r: any) => {
            const on = Number(r.raceNumber) === Number(race?.raceNumber);
            return (
              <button
                key={r.raceNumber}
                type="button"
                onClick={() => setRaceNo(Number(r.raceNumber))}
                className={`shrink-0 rounded-[6px] border px-2.5 py-1.5 text-left ${
                  on ? "border-gold-strong bg-gold-bg text-gold" : "border-hairline bg-paper text-ink-2"
                }`}
              >
                <span className="block font-mono-tx text-[11px] font-bold">R{r.raceNumber}{(r.picks ?? []).some((p: any) => p.officialChange) ? <span className="ml-1 text-lose">退出</span> : null}</span>
                <span className="mt-0.5 block font-mono-tx text-[8px] text-ink-3">{cleanTime(r.startTime) || "—"} · {r.distance || "—"}m</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-4 mb-2.5 mt-2">
        <label
          htmlFor="tp-race-select"
          className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3"
        >
          揀場次
        </label>
        <div className="relative">
          <select
            id="tp-race-select"
            disabled={races.length === 0}
            value={String(race?.raceNumber ?? raceNo)}
            onChange={(e) => setRaceNo(Number(e.target.value))}
            className="w-full appearance-none rounded-[10px] border border-hairline bg-paper-2 py-[11px] pl-3 pr-9 font-sans-tc text-[13px] font-semibold text-ink"
          >
            {races.length === 0 ? <option value={String(raceNo)}>{tp.isLoading ? "核對場次中…" : tp.error ? "場次暫未能讀取" : "暫未有場次"}</option> : null}
            {races.map((r: any) => {
              const cls = r.class ? ` · ${r.class}` : "";
              const dist = r.distance ? ` · ${r.distance}m` : "";
              const q = r.raceQuality?.tier ? ` · 場質${r.raceQuality.tier}` : "";
              return (
                <option key={r.raceNumber} value={String(r.raceNumber)}>
                  R{r.raceNumber}
                  {cls}
                  {dist}
                  {q}
                </option>
              );
            })}
          </select>
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>

      {race && raceLight && !invalidInput ? (
        <div className="mx-4 mb-3">
          <PredictionStatusLight status={raceLight} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Pill tone="gold">R{race.raceNumber} · {race.distance || "—"}m</Pill>
            <Pill>{race.going || "地質待公布"}</Pill>
            <Pill>{racingClassLabel(race.class)}</Pill>
            <Pill tone={race.scoreSource === "lgb" ? "win" : "ink"}>{race.scoreSource === "lgb" ? "天喜LGB" : "天喜ELO 基準"}</Pill>
            {typeof race.ensembleAlpha === "number" ? <Pill>α={race.ensembleAlpha.toFixed(2)}</Pill> : null}
            {start ? <Pill>{start} 開跑</Pill> : null}
          </div>
        </div>
      ) : null}

      {race && invalidInput ? (
        <div role="alert" className="mx-4 mb-3 border border-lose/40 bg-paper px-3 py-3 text-[12px] text-lose">
          <p className="font-bold">第 {race.raceNumber} 場：{'退出公布時間未能核實，暫停提供四揀'}</p>
          <p className="mt-1">鎖前更改應即時更新排位並重算該場；今場未能及時重算，原凍結只保留作紀錄，不計分，亦不以賽後重算冒充賽前預測。</p>
          {(race.picks || []).filter((p: any) => p.officialChange).map((p: any) => <p key={p.horseNumber} className="mt-1">{p.horseNumber} 號 {p.nameCh}：馬會 {p.officialChange.announcedAt} 公布，{p.officialChange.text}</p>)}
          <Link to="/race-changes" className="mt-2 inline-block font-bold text-gold">查看馬會更改證據 →</Link>
        </div>
      ) : null}

      {race && sub.withdrawn.length > 0 && !invalidInput ? <div role="status" className="mx-4 mb-3 border border-lose/40 bg-paper px-3 py-2 text-[12px] text-ink"><p className="font-bold text-lose">第{race.raceNumber}場：{sub.prelockNotRecomputed ? '鎖前退出未及重算，按鎖後方式計' : '鎖後退出'}，原四揀不變</p><p className="mt-1">原四揀 {sub.original.join("-")}，{sub.withdrawn.join("、")}號當無效、唔補位；命中照計「中幾匹／4」，盈虧按馬會退款及派彩規則。</p></div> : null}

      {race && !invalidInput ? <PredictorComparison modelCol={modelCol} marketCol={marketCol} locked={locked} sub={sub} /> : null}

      {race?.picks?.length && !invalidInput ? (
        <Card title={`第 ${race.raceNumber} 場 模型 vs 市場`} en="Model vs Market" className="mx-4 mb-3">
          <ModelVsMarketDumbbell
            picks={(race.picks || []).map((p: any) => ({
              horseNumber: p.horseNumber,
              nameCh: p.nameCh,
              pWin: p.pWin,
              pTop4: p.pTop4,
              od: liveOdds(p.horseNumber) ?? p.winOdds ?? null,
            }))}
            oddsNote={oddsNote}
          />
        </Card>
      ) : null}

      {featHorses.length ? (
        <section className="mx-4 mb-3 rounded-[10px] border border-hairline bg-paper-2 px-2.5 py-2.5">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="font-serif-tc text-[13px] font-bold text-ink">六項賽前證據</h2>
            <Link to="/features" className="text-[10px] font-bold text-gold">完整排序 →</Link>
          </div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[7px] border border-hairline bg-hairline">
            {evidence.map(({ id, label, leader, stat }) => (
              <div key={id} className="min-w-0 bg-paper px-2 py-2">
                <p className="text-[9px] font-bold text-ink-3">{label}</p>
                {leader && stat ? (
                  <>
                    <p className="mt-1 truncate font-serif-tc text-[11px] font-bold text-ink">#{leader.no} {leader.name}</p>
                    <p className="tabnum mt-0.5 truncate font-mono-tx text-[9px] text-gold">{stat.metric}</p>
                  </>
                ) : <p className="mt-1 text-[10px] text-ink-3">資料未齊</p>}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[9px] leading-relaxed text-ink-3">每格顯示該項目前列馬匹；完整名次、樣本與自選組合請開啟特徵排序表。</p>
        </section>
      ) : null}

      {cov && !invalidInput ? (
        <div className="mx-4 mb-3 rounded-[10px] border border-hairline bg-paper p-2.5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="font-serif-tc text-[12px] font-bold text-ink">箱形覆蓋率估算</p>
            {race?.raceQuality?.tier ? (
              <Pill tone="gold">
                同日 #{race.raceQuality.rank}/{race.raceQuality.total} · 場質{race.raceQuality.tier}
              </Pill>
            ) : null}
          </div>
          <div className="tabnum grid grid-cols-4 gap-y-1 font-mono-tx text-[11px]">
            <span />
            <span className="text-center text-[9px] text-ink-3">揀4</span>
            <span className="text-center text-[9px] text-ink-3">揀5</span>
            <span className="text-center text-[9px] text-ink-3">揀6</span>
            <span className="text-[10px] text-ink-2">三重彩（頭三名複式）</span>
            <span className="text-center font-bold text-ink">{pct(cov.trio_n4)}</span>
            <span className="text-center text-ink-2">{pct(cov.trio_n5)}</span>
            <span className="text-center text-ink-2">{pct(cov.trio_n6)}</span>
            <span className="text-[10px] text-ink-2">四重彩（頭四名複式）</span>
            <span className="text-center font-bold text-ink">{pct(cov.first4_n4)}</span>
            <span className="text-center text-ink-2">{pct(cov.first4_n5)}</span>
            <span className="text-center text-ink-2">{pct(cov.first4_n6)}</span>
          </div>
          <p className="mt-1.5 text-[9px] leading-relaxed text-ink-3">
            「揀N」＝取模型前 N 名落箱；數值為模型估算命中機率，只作同日相對比較揀場之用，非投注建議。
          </p>
        </div>
      ) : null}



      <PredictorEnginePicks race={race} invalidInput={invalidInput} tp={tp} start={start} sub={sub} liveOdds={liveOdds} />

      {race && !invalidInput ? (
        <Card title="本場一句" en="Race Explain">
          <p className="mb-2 text-[11px] leading-relaxed text-ink-2">
            只讀本場四揀同獨贏／位置機率填空。唔改排名、唔用 TreeSHAP、頭馬接近章未校準所以唔出。
          </p>
          <HorseExplainChip
            picks={race.picks}
            frozen={Boolean(tp.frozen)}
            scoreSource={race.scoreSource}
            ensembleAlpha={race.ensembleAlpha}
          />
        </Card>
      ) : null}

      {tp.date && race && !invalidInput ? <RacePositionMap date={tp.date} raceId={race.raceId ?? featRaceId ?? undefined} distance={Number(race.distance) || 0} picks={picks} frozen={Boolean(tp.frozen)} /> : null}

      <Card title="點解揀佢" en="Why These Picks">
        {tp.isLoading ? <Loading label="核對本場預測中…" /> : tp.error ? <Empty label="預測讀取未成功，解釋暫未能提供" /> : invalidInput ? <Empty label="本場原凍結輸入無效，不提供入選解釋" /> : (race?.picks || []).length ? (race.picks || []).slice(0, 4).map((p: any) => <LivePickEvidence key={p.horseNumber} raceId={race.raceId ?? featRaceId ?? undefined} horseId={p.horseId} name={`#${p.horseNumber} ${p.nameCh}`} />) : <Empty label="未有本場預測" />}
      </Card>

      <Card title="特徵排序實驗室" en="Feature Lab">
        <p className="mb-2 text-[11px] leading-relaxed text-ink-2">
          十項特徵（同場對賽、同程、檔位、最快時間、最快末段、騎練合作等）逐項排名，並可自選組合運算綜合排序，全部由歷史賽事資料實時計算。屬研究輔助，非預測模型。
        </p>
        <Link
          to="/features"
          className="inline-block rounded-[8px] border border-gold-strong/50 bg-gold-bg px-3 py-2 text-[12px] font-bold text-gold"
        >
          打開特徵排序表 →
        </Link>
      </Card>

      <details className="mx-4 my-3 rounded-[10px] border border-hairline bg-paper-2">
        <summary className="cursor-pointer px-3 py-2.5 font-serif-tc text-[12px] font-bold text-ink">馬場即時天氣與跑道狀況</summary>
        <div className="border-t border-hairline pb-1 pt-3"><WeatherPanel venue={tp.venue ?? undefined} /></div>
      </details>

      <Disclaimer />
    </AppShell>
  );
}
