import { FeaturePageGate } from "@/components/tx/gates/FeaturePageGate";
import { featureReadDeadline } from "@/lib/feature-read-deadline";
import { Button } from "@/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/tx/AppShell";
import { CompositeOverview } from "@/components/tx/CompositeOverview";
import { FeatureRankingTable } from "@/components/tx/FeatureRankingTable";
import { FeaturePickerSheet } from "@/components/tx/FeaturePickerSheet";
import { FeatureWeightPanel } from "@/components/tx/FeatureWeightPanel";
import { BacktestPanel } from "@/components/tx/BacktestPanel";
import { Card, Disclaimer, ErrorNote, Loading, PageHead, Pill } from "@/components/tx/ui";
import { computeComposite, computeWeightedComposite, rankByFeature } from "@/lib/feature-ranking";
import { defaultWeights, loadStrategies, planLocalStrategiesMigration, type FeatureWeightSpec, type SavedStrategy } from "@/lib/lab-backtest";
import { listUserStrategies, migrateLocalStrategies } from "@/lib/user-strategies.functions";
import { getFeatureRace, listFeatureRaces } from "@/lib/features.functions";
import { FEATURES, type FeatureId } from "@/lib/race-data";
import { fmtMeetingDate, txApi } from "@/lib/tx-api";
import { useTier } from "@/lib/useTier";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "特徵排序表 · 天喜 TIANXI" },
      {
        name: "description",
        content: "逐場賽馬特徵排序：同場對賽勝次、最佳同程、檔位、最快時間與末段、騎練合作，可自選組合運算綜合排序；Pro 可調權重同回測。",
      },
      { property: "og:title", content: "特徵排序表 · 天喜 TIANXI" },
      { property: "og:description", content: "全特徵目錄逐場排序與自選綜合排序，全部由歷史賽事資料實時運算。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <FeaturePageGate min="registered" title="特徵排序表"><FeaturesPage /></FeaturePageGate>,
});

function FeaturesPage() {
  const tier = useTier();
  const isPro = tier.has("pro");
  const [date, setDate] = useState<string | undefined>(undefined);
  const [raceId, setRaceId] = useState<string | null>(null);
  const [features, setFeatures] = useState<FeatureId[]>(["h2h", "distance", "draw", "time"]);
  const [weights, setWeights] = useState<FeatureWeightSpec[]>(() => defaultWeights(["h2h", "distance", "draw", "time"]));
  const [active, setActive] = useState<FeatureId | null>("h2h");
  const [strategies, setStrategies] = useState<SavedStrategy[]>(() =>
    typeof window !== "undefined" ? loadStrategies() : [],
  );
  const [strategySource, setStrategySource] = useState<"local" | "cloud">("local");
  const listStrategiesFn = useServerFn(listUserStrategies);
  const migrateFn = useServerFn(migrateLocalStrategies);

  async function refreshStrategies() {
    if (!isPro) {
      setStrategies(loadStrategies());
      setStrategySource("local");
      return;
    }
    try {
      const res = await listStrategiesFn();
      setStrategies(res.strategies);
      setStrategySource("cloud");
    } catch {
      setStrategies(loadStrategies());
      setStrategySource("local");
    }
  }

  useEffect(() => {
    void refreshStrategies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro]);

  useEffect(() => {
    setWeights((prev) => {
      const map = new Map(prev.map((w) => [w.id, w]));
      return features.map((id) => map.get(id) ?? { id, weight: 1, invert: false });
    });
  }, [features]);

  const listFn = useServerFn(listFeatureRaces);
  const raceFn = useServerFn(getFeatureRace);

  const list = useQuery({
    queryKey: ["featureRaces", date ?? "latest"],
    queryFn: () => featureReadDeadline(listFn({ data: { date } })),
    retry: false,
  });

  const races = list.data?.races ?? [];
  const currentId = raceId && races.some((r) => r.id === raceId) ? raceId : (races[0]?.id ?? null);

  const detail = useQuery({
    queryKey: ["featureRace", currentId],
    queryFn: () => { if (!currentId) throw new Error("未有場次"); return featureReadDeadline(raceFn({ data: { raceId: currentId } })); },
    retry: false,
    enabled: !!currentId,
  });

  const race = detail.data?.race;

  const oddsQ = useQuery({
    queryKey: ["meeting", race?.date],
    queryFn: () => { if (!race?.date) throw new Error("未有賽日"); return txApi.meeting(race.date); },
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

  const useWeighted = useMemo(() => {
    if (!isPro) return false;
    return weights.some((w) => w.weight !== 1 || w.invert) || weights.length !== features.length;
  }, [isPro, weights, features.length]);

  const compositeRows = useWeighted
    ? computeWeightedComposite(horses, weights)
    : computeComposite(horses, features);
  const selectedForComposite = useWeighted
    ? weights.filter((w) => w.weight > 0).map((w) => w.id)
    : features;
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
        desc="引擎特徵目錄全部列出，可即場排序者逐項排名；Pro 可調權重、回測組合（研究層，唔入公開戰績）。"
      />

      <Card title="選擇賽事" en="Select Race">
        {list.isLoading ? (
          <Loading />
        ) : list.error ? (
          <><ErrorNote error={list.error} /><Button variant="outline" size="sm" onClick={() => void list.refetch()}>重新讀取</Button></>
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
          引擎特徵目錄全部列出，其中可即場排序者可任選組合；綜合分預設為所選特徵標準化分數平均值；Pro 可改為加權。
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

      <Card title="調權重（研究層）" en="Weights">
        <FeatureWeightPanel
          selected={features}
          weights={weights}
          onChange={setWeights}
          locked={!isPro}
        />
      </Card>

      {detail.isLoading ? (
        <Loading />
      ) : detail.error ? (
        <div className="px-4">
          <ErrorNote error={detail.error} />
          <Button variant="outline" size="sm" onClick={() => void detail.refetch()}>重新讀取</Button>
        </div>
      ) : horses.length ? (
        <>
          <CompositeOverview rows={compositeRows} selected={selectedForComposite} />
          <FeatureRankingTable
            selected={features}
            active={activeFeature}
            onSelectActive={setActive}
            rows={featureRows}
          />
        </>
      ) : null}

      <Card title="回測呢個組合" en="Backtest">
        <BacktestPanel weights={weights} locked={!isPro} />
      </Card>

      <Card title="我的策略（帳號）" en="My strategies">
        <p className="mb-2 text-[11px] text-ink-2">
          Pro 登入後存帳號（Supabase <code>user_strategies</code>，研究層，唔入公開戰績）。
          未登入／雲端失敗時用本機暫存；首次成功登入可明示「遷移本機→雲端」，唔會 silently 丟資料。
          而家來源：{strategySource === "cloud" ? "帳號" : "本機"}。
        </p>
        {strategies.length === 0 ? (
          <p className="text-[12px] text-ink-2">尚未儲存策略。Pro 用戶可喺回測卡命名後儲存。</p>
        ) : (
          <ul className="space-y-1 text-[12px]">
            {strategies.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-[4px] border border-hairline px-2 py-1">
                <span className="font-bold">{s.name}</span>
                <span className="font-mono-tx text-[11px] text-ink-2">v{s.version}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-auto h-7 text-[11px]"
                  onClick={() => {
                    setFeatures(s.weights.map((w) => w.id as FeatureId));
                    setWeights(s.weights);
                  }}
                >
                  載入
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refreshStrategies()}
          >
            重新整理清單
          </Button>
          {isPro ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void (async () => {
                  const local = loadStrategies();
                  const cloudNames = new Set(
                    strategySource === "cloud" ? strategies.map((s) => s.name.trim()) : [],
                  );
                  const plan = planLocalStrategiesMigration(local, cloudNames);
                  if (!plan.toUpsert.length) {
                    alert("冇需要遷移嘅本機策略（空白或名稱已喺雲端）。本機副本會保留。");
                    return;
                  }
                  if (
                    !confirm(
                      `會將 ${plan.toUpsert.length} 條本機策略複製上雲端（唔刪本機、唔覆蓋同名雲端）。確認？`,
                    )
                  ) {
                    return;
                  }
                  try {
                    const res = await migrateFn({
                      data: {
                        strategies: plan.toUpsert.map((s) => ({
                          name: s.name,
                          note: s.note,
                          weights: s.weights,
                          pools: s.pools,
                        })),
                      },
                    });
                    alert(`已遷移 ${res.migrated.length} 條；略過 ${res.skipped}。本機仍保留。`);
                    await refreshStrategies();
                  } catch (e: any) {
                    alert(`遷移失敗：${e?.message ?? e}`);
                  }
                })();
              }}
            >
              遷移本機→雲端
            </Button>
          ) : null}
        </div>
      </Card>

      <Disclaimer />
    </AppShell>
  );
}
