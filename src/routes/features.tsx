import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { AppShell } from "@/components/tx/AppShell";
import { CompositeOverview } from "@/components/tx/CompositeOverview";
import { FeatureRankingTable } from "@/components/tx/FeatureRankingTable";
import { FeaturePickerSheet } from "@/components/tx/FeaturePickerSheet";
import { Card, Disclaimer, ErrorNote, Loading, PageHead, Pill } from "@/components/tx/ui";
import { computeComposite, rankByFeature } from "@/lib/feature-ranking";
import { getFeatureRace, listFeatureRaces } from "@/lib/features.functions";
import { FEATURES, type FeatureId } from "@/lib/race-data";
import { fmtMeetingDate, txApi } from "@/lib/tx-api";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "特徵排序表 · 天喜 TIANXI" },
      {
        name: "description",
        content: "逐場賽馬特徵排序：同場對賽勝次、最佳同程、檔位、最快時間與末段、騎練合作，可自選組合運算綜合排序。",
      },
      { property: "og:title", content: "特徵排序表 · 天喜 TIANXI" },
      { property: "og:description", content: "全特徵目錄逐場排序與自選綜合排序，全部由歷史賽事資料實時運算。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FeaturesPage,
});

function FeaturesPage() {
  const [date, setDate] = useState<string | undefined>(undefined);
  const [raceId, setRaceId] = useState<string | null>(null);
  const [features, setFeatures] = useState<FeatureId[]>(["h2h", "distance", "draw", "time"]);
  const [active, setActive] = useState<FeatureId | null>("h2h");

  const listFn = useServerFn(listFeatureRaces);
  const raceFn = useServerFn(getFeatureRace);

  const list = useQuery({
    queryKey: ["featureRaces", date ?? "latest"],
    queryFn: () => listFn({ data: { date } }),
  });

  const races = list.data?.races ?? [];
  const currentId = raceId && races.some((r) => r.id === raceId) ? raceId : (races[0]?.id ?? null);

  const detail = useQuery({
    queryKey: ["featureRace", currentId],
    queryFn: () => raceFn({ data: { raceId: currentId! } }),
    enabled: !!currentId,
  });

  const race = detail.data?.race;

  // 即時獨贏賠率：由馬會賠率源（後端 meetings API）補入，排位表本身冇賠率
  const oddsQ = useQuery({
    queryKey: ["meeting", race?.date],
    queryFn: () => txApi.meeting(race!.date),
    enabled: !!race?.date,
    refetchInterval: 60_000,
  });
  const oddsMap = new Map<number, number>();
  const oddsRace = (oddsQ.data?.races ?? []).find(
    (r: any) => Number(r.raceNumber) === Number(race?.raceNumber),
  );
  for (const h of (oddsRace as { horses?: Array<{ horseNumber?: unknown; winOdds?: unknown }> } | undefined)?.horses ?? []) {
    if (h.winOdds != null) oddsMap.set(Number(h.horseNumber), Number(h.winOdds));
  }

  const horses = (detail.data?.horses ?? []).map((h) =>
    (h.odds ?? 0) > 0 ? h : { ...h, odds: oddsMap.get(Number(h.no)) ?? h.odds },
  );
  const compositeRows = computeComposite(horses, features);
  const activeFeature = active && features.includes(active) ? active : (features[0] ?? null);
  const featureRows = activeFeature && horses.length ? rankByFeature(horses, activeFeature) : [];


  return (
    <AppShell
      page="predictor"
      ticker={
        race
          ? `${fmtMeetingDate(race.date)} · ${race.venueLabel} · 第 ${race.raceNumber} 場 · ${race.distance ?? "?"}m`
          : "載入賽事資料…"
      }
    >
      <PageHead
        en="Feature Ranking"
        title="特徵排序表"
        desc="引擎特徵目錄全部列出，可即場排序者逐項排名，全部由該場之前的歷史賽事資料計算；今日排位表一出即可運算。"
      />

      <Card title="選擇賽事" en="Select Race">
        {list.isLoading ? (
          <Loading />
        ) : list.error ? (
          <ErrorNote error={list.error} />
        ) : (
          <div className="space-y-2">
            <div className="no-scrollbar flex gap-1 overflow-x-auto">
              {(list.data?.dates ?? []).map((d) => {
                const on = d === (date ?? list.data?.dates?.[0]);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      setDate(d);
                      setRaceId(null);
                    }}
                    className={`tabnum shrink-0 rounded-[4px] border px-2 py-1 font-mono-tx text-[11px] ${
                      on ? "border-gold-strong bg-gold-bg font-bold text-gold" : "border-hairline bg-paper text-ink-2"
                    }`}
                  >
                    {d.slice(5)}
                  </button>
                );
              })}
            </div>
            <div className="no-scrollbar flex gap-1 overflow-x-auto">
              {races.map((r) => {
                const on = r.id === currentId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRaceId(r.id)}
                    className={`tabnum shrink-0 rounded-[4px] border px-2.5 py-1 font-mono-tx text-[11px] font-bold ${
                      on ? "border-deep bg-deep text-deep-fg" : "border-hairline bg-paper text-ink-2"
                    }`}
                  >
                    R{r.raceNumber}
                  </button>
                );
              })}
            </div>
            {race ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <Pill tone="gold">{race.distance ?? "—"}m</Pill>
                <Pill>{race.className || "—"}</Pill>
                <Pill>{race.going || "—"}</Pill>
                <Pill>{race.course || "—"}</Pill>
                <Pill>樣本 {detail.data?.sampleStarts ?? 0} 仗</Pill>
              </div>
            ) : null}
          </div>
        )}
      </Card>

      <Card title="特徵選項" en="Features">
        <p className="mb-2 text-[11px] leading-relaxed text-ink-2">
          引擎特徵目錄全部列出，其中可即場排序者可任選組合；綜合分為所選特徵標準化分數的平均值。
        </p>
        <FeaturePickerSheet
          selected={features}
          onToggle={(id) =>
            setFeatures((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]))
          }
          onSelectAll={() => setFeatures(FEATURES.map((f) => f.id))}
          onClear={() => setFeatures([])}
        />
      </Card>


      {detail.isLoading ? (
        <Loading />
      ) : detail.error ? (
        <div className="px-4">
          <ErrorNote error={detail.error} />
        </div>
      ) : horses.length ? (
        <>
          <CompositeOverview rows={compositeRows} selected={features} />
          <FeatureRankingTable
            selected={features}
            active={activeFeature}
            onSelectActive={setActive}
            rows={featureRows}
          />
        </>
      ) : null}

      <Disclaimer />
    </AppShell>
  );
}
