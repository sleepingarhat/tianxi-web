import { TieredDayCards } from "@/components/tx/gates/TieredDayCards";
import { useTier } from "@/lib/useTier";
import { TierGate } from "@/components/tx/gates/TierGate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AlphaGuard } from "@/components/tx/AlphaGuard";
import { CourseMapButton } from "@/components/tx/CourseMapButton";
import { AppShell } from "@/components/tx/AppShell";
import {
  Card,
  Disclaimer,
  Empty,
  ErrorNote,
  Loading,
  PageHead,
  Pill,
  Seg,
  Stat,
  StatGrid,
  Table,
  Td,
  Silks,
} from "@/components/tx/ui";
import { BarRow, BeamCard, ChipRow, DataChip, KpiTile, KV, KVGrid, MeterBar, Ring, TxBar, Timeline, TrendChart } from "@/components/tx/viz";
import { CloseGapPanel } from "@/components/tx/CloseGapPanel";
import { fmtMeetingDate, num, pct, txApi } from "@/lib/tx-api";
import { useTodayPicks } from "@/lib/use-today-picks";
import type { VenueWeather } from "@/routes/api/public/hkjc-weather";

type WeatherResponse = { venues: VenueWeather[] };

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "天喜賽馬引擎 · 天喜 TIANXI" },
      { name: "description", content: "當前賽馬日概況、引擎首選、騎師練馬師榜與馬匹評分榜一頁掌握。" },
      { property: "og:title", content: "天喜賽馬引擎 · 天喜 TIANXI" },
      { property: "og:description", content: "當前賽馬日概況、引擎首選與人馬排行榜。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const tier = useTier();
  const [board, setBoard] = useState<"elo" | "wins" | "starts">("elo");
  const [people, setPeople] = useState<"jockeys" | "trainers">("jockeys");

  const smart = useQuery({ queryKey: ["smartCurrent"], queryFn: () => txApi.smartCurrent() });
  const todayPicks = useTodayPicks();
  const weather = useQuery<WeatherResponse>({
    queryKey: ["hkjcWeather"],
    queryFn: async () => {
      const response = await fetch("/api/public/hkjc-weather");
      if (!response.ok) throw new Error("天氣資料讀取失敗");
      return response.json();
    },
    refetchInterval: 60_000,
  });
  const rollup = useQuery({ queryKey: ["rollup", 90], queryFn: () => txApi.hitRateRollup(90) });
  const long = useQuery({ queryKey: ["rollup", 365], queryFn: () => txApi.hitRateRollup(365) });
  const pnl = useQuery({ queryKey: ["strategyPnl", "dashboard"], enabled: tier.has("pro"), queryFn: () => txApi.strategyPnl() });

  const leaderboard = useQuery({
    queryKey: ["horseLeaderboard", board],
    queryFn: () => txApi.horseLeaderboard(board, 10, "active"),
  });
  const jockeys = useQuery({ queryKey: ["jockeys"], queryFn: () => txApi.jockeys() });
  const trainers = useQuery({ queryKey: ["trainers"], queryFn: () => txApi.trainers() });

  const m = smart.data;
  const races: any[] = todayPicks.races;
  const meetingRaces: any[] = m?.races || todayPicks.meeting?.races || [];
  const firstStartTime = meetingRaces[0]?.startTime || races[0]?.startTime || null;
  const venueWeather = (weather.data?.venues || []).find((item) => item.venue === m?.venue);
  const liveWeather = venueWeather
    ? venueWeather.rain10Min != null && venueWeather.rain10Min > 0
      ? "有雨"
      : venueWeather.rainToday != null && venueWeather.rainToday > 0
        ? "曾有雨"
        : "無雨"
    : m?.weather || null;
  const per: any[] = (long.data?.perMeeting || []).slice().sort((a: any, b: any) => (a.date < b.date ? -1 : 1));
  const pb: Record<string, { wins?: number; bets?: number }> | undefined = pnl.data?.poolBreakdown;
  const pnlFrom: string = pnl.data?.from ? fmtMeetingDate(pnl.data.from) : "近期";

  const peopleRows: any[] =
    people === "jockeys" ? (jockeys.data?.jockeys || []).slice(0, 10) : (trainers.data?.trainers || []).slice(0, 10);

  // 集成模型詳情（由全日預測回傳的引擎中介資料整理）
  const eng = todayPicks.engine;
  const alphas = races.map((r) => r.ensembleAlpha).filter((a: any) => typeof a === "number");
  const avgAlpha = alphas.length ? alphas.reduce((a: number, b: number) => a + b, 0) / alphas.length : null;
  const lgbRaces = races.filter(
    (r) => String(r.scoreSource || "").includes("lgb") || String(r.scoreSource || "").includes("oracle") || r.lgbCoverage?.applied === true,
  ).length;
  const oddsRaces = races.filter((r) => (r.picks || []).some((p: any) => p.winOdds != null)).length;
  const r90 = rollup.data;
  const ratioOf = (v: any, of: number) => (v != null && Number.isFinite(Number(v)) ? Number(v) / of : null);

  return (
    <AppShell
      page="horse"
      ticker={m ? `${fmtMeetingDate(m.date)} · ${m.venueName} · ${m.trackCondition || "場地待定"}` : "載入中…"}
    >
      <PageHead en="TX-ORACLE · HORSE RACING" title="天喜賽馬引擎" desc="當前賽馬日、引擎首選與長期表現指標。" />

      <TierGate min="registered" feature="引擎儀表板" mode="lock">
      {/* 主指標概覽 */}
      <div className="px-4 pt-3">
        <BeamCard className="p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <p className="font-mono-tx text-[8px] uppercase tracking-[0.22em] text-ink-3">Core KPI</p>
              <p className="mt-0.5 font-serif-tc text-[15px] font-bold text-ink">四揀平均命中匹數</p>
              <p className="tabnum mt-1 font-mono-tx text-[28px] font-bold leading-none text-gold">
                {num(r90?.top4AvgIntersect, 2)}
                <span className="ml-1 text-[12px] text-ink-3">／4 匹</span>
              </p>
              <p className="mt-1 text-[9px] leading-tight text-ink-3">
                近 90 日 {r90?.racesEvaluated ?? 0} 場 · {r90?.meetingsEvaluated ?? 0} 個賽馬日
              </p>
            </div>
            <Ring
              ratio={ratioOf(r90?.top4AvgIntersect, 4)}
              size={62}
              label={`${num(r90?.top4AvgIntersect != null ? (Number(r90.top4AvgIntersect) / 4) * 100 : null, 0)}%`}
              sub="命中率"
            />
          </div>
          <div className="mt-2.5 border-t border-gold/25 pt-2">
            <ChipRow>
              <DataChip k="三甲平均" v={`${num(r90?.top3AvgIntersect, 2)}／3`} tone="gold" />
              <DataChip k="今日場次" v={races.length ? `${races.length} 場` : "準備中"} tone={races.length ? "win" : "lose"} />
              <DataChip k="賠率覆蓋" v={`${oddsRaces}/${races.length || 0}`} tone={oddsRaces ? "win" : "ink"} />
              <DataChip k="天喜LGB 覆蓋" v={`${lgbRaces}/${races.length || 0}`} tone={lgbRaces ? "win" : "ink"} />
            </ChipRow>
          </div>
        </BeamCard>
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 pt-2">
        <Link
          to="/strategy-pnl"
          className="rounded-[10px] bg-deep px-3 py-2.5 text-center text-deep-fg shadow-[0_2px_0_var(--tx-hairline)]"
        >
          <span className="block font-serif-tc text-[13px] font-bold">天喜策略累計盈虧</span>
          <span className="mt-0.5 block font-mono-tx text-[8px] uppercase tracking-[0.2em] text-gold">Strategy P&amp;L</span>
        </Link>
        <Link to="/prediction-vs-result" className="rounded-[10px] border border-gold bg-gold-bg px-3 py-2.5 text-center">
          <span className="block font-serif-tc text-[13px] font-bold text-ink">預測與賽果</span>
          <span className="mt-0.5 block font-mono-tx text-[8px] uppercase tracking-[0.2em] text-ink-3">Picks vs Results</span>
        </Link>
      </div>

      <Card
        title="下一個賽馬日"
        en="Next Meeting"
        action={
          <Link to="/schedule" className="text-[11px] font-bold text-gold">
            賽期 →
          </Link>
        }
      >
        {smart.isLoading ? (
          <Loading />
        ) : smart.error ? (
          <ErrorNote error={smart.error} />
        ) : m ? (
          <div className="space-y-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-3">
              <div className="min-w-0">
                <p className="truncate font-serif-tc text-[18px] font-bold">{m.venueName}</p>
                <p className="tabnum font-mono-tx text-[11px] text-ink-2">{fmtMeetingDate(m.date)}</p>
              </div>
              <div className="-ml-3">
                <CourseMapButton venue={m.venue ?? undefined} going={m.trackCondition ?? undefined} />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Pill tone="gold">{m.mode === "historical" ? "歷史模式" : m.mode === "upcoming" ? "即將舉行" : "現役賽期"}</Pill>
                <Pill>{m.totalRaces} 場</Pill>
              </div>
            </div>
            <ChipRow>
              <DataChip k="場地" v={m.trackCondition || "待公佈"} tone="gold" />
              <DataChip k="天氣" v={liveWeather || "讀取中"} />
              <DataChip k="首場" v={firstStartTime || "讀取中"} />
              <DataChip k="階段" v={m.isEntryListOnly ? "排位表" : "完整資料"} tone={m.isEntryListOnly ? "ink" : "win"} />
            </ChipRow>
            <div className="rounded-[10px] border border-hairline bg-paper px-2.5 py-1.5">
              <KVGrid
                rows={[
                  { k: "賽事日期", v: m.date || "—" },
                  { k: "馬場", v: `${m.venueName || "—"}（${m.venue || "—"}）` },
                  { k: "場地狀況", v: m.trackCondition || "待公佈" },
                  { k: "天氣", v: liveWeather || "讀取中" },
                  { k: "場次", v: `${m.totalRaces ?? "—"} 場` },
                  { k: "首場開跑", v: firstStartTime || "讀取中" },
                ]}
              />
            </div>
          </div>
        ) : null}
      </Card>

      <Card
        title="集成模型"
        en="Ensemble"
        action={
          <Link to="/engine" className="text-[11px] font-bold text-gold">
            引擎 →
          </Link>
        }
      >
        {todayPicks.isLoading ? (
          <Loading />
        ) : (
          <div className="space-y-2.5">
            <div className="space-y-2.5 rounded-[10px] border border-hairline bg-paper px-2.5 py-2.5">
              <MeterBar
                label="天喜LGB 覆蓋"
                en="LGB"
                ratio={races.length ? lgbRaces / races.length : 0}
                value={`${lgbRaces}/${races.length || 0}`}
                sub="已套用天喜LGB 排序模型嘅場數"
                tone="gold"
              />
              <MeterBar
                label="賠率覆蓋"
                en="Market"
                ratio={races.length ? oddsRaces / races.length : 0}
                value={`${oddsRaces}/${races.length || 0}`}
                sub="有臨場盤口可對照嘅場數（純對照）"
                tone="win"
              />
              <MeterBar
                label="融合 α"
                en="Alpha"
                ratio={avgAlpha}
                value={avgAlpha != null ? avgAlpha.toFixed(2) : "—"}
                sub="α 愈高＝最終排序愈側重天喜LGB"
                tone="ink"
              />
            </div>
            <p className="px-0.5 text-[9px] leading-tight text-ink-3">
              集成覆蓋 = 已套用「天喜LGB」排序模型嘅場數；未覆蓋嘅場數自動退回「天喜ELO」基準評分。
            </p>
            <AlphaGuard alpha={avgAlpha} />
            <div className="rounded-[10px] border border-hairline bg-paper px-2.5 py-1.5">
              <KVGrid
                rows={[
                  { k: "評分來源", v: races[0]?.scoreSource || "—" },
                  { k: "天喜ELO 引擎", v: eng?.eloEngine ? `天喜ELO ${eng.eloEngine}` : "—" },
                  {
                    k: "天喜ELO 權重（馬／騎／練）",
                    v: eng?.eloWeights
                      ? `${eng.eloWeights.horse} / ${eng.eloWeights.jockey} / ${eng.eloWeights.trainer}`
                      : "—",
                  },
                  { k: "天喜LGB 模型版本", v: eng?.lgbModelVersion || "未載入" },
                  { k: "天喜LGB 覆蓋", v: races.length ? `${lgbRaces} / ${races.length} 場 · ${eng?.lgbCoverage?.rows ?? 0} 匹` : "—" },
                  { k: "融合權重 α（平均）", v: avgAlpha != null ? avgAlpha.toFixed(2) : "—" },
                  { k: "盤口權重 β", v: races[0]?.marketBeta != null ? String(races[0].marketBeta) : "—" },
                  { k: "機率模型", v: races[0]?.probabilityModel || "harville-v1" },
                  { k: "盤口覆蓋", v: races.length ? `${oddsRaces} / ${races.length} 場有賠率` : "—" },
                  {
                    k: "賠率快照時間",
                    v: races[0]?.oddsSnapshotAt ? new Date(races[0].oddsSnapshotAt).toLocaleString("zh-HK") : "待開盤",
                  },
                  { k: "運算耗時", v: eng?.computeMs != null ? `${(eng.computeMs / 1000).toFixed(1)} 秒` : "—" },
                  {
                    k: "預測生成時間",
                    v: todayPicks.generatedAt ? new Date(todayPicks.generatedAt).toLocaleString("zh-HK") : "—",
                  },
                ]}
              />
            </div>
          </div>
        )}
      </Card>

      <Card title="模型狀態" en="Model Status">
        <div className="space-y-2">
          <ChipRow>
            <DataChip k="全日預測" v={races.length ? "就緒" : "準備中"} tone={races.length ? "win" : "lose"} />
            <DataChip k="TX-Oracle" v={lgbRaces ? "啟用" : "純天喜ELO"} tone={lgbRaces ? "win" : "lose"} />
            <DataChip k="賠率快照" v={oddsRaces ? "已接入" : "等待開盤"} tone={oddsRaces ? "win" : "lose"} />
            <DataChip k="天喜ELO" v={eng?.eloReady ? "就緒" : "未就緒"} tone={eng?.eloReady ? "win" : "lose"} />
          </ChipRow>
          <div className="rounded-[10px] border border-hairline bg-paper px-2.5 py-1.5">
            <KVGrid
              rows={[
                {
                  k: "全日預測",
                  v: races.length ? `就緒 · ${races.length} 場` : todayPicks.isLoading ? "載入中" : "準備中",
                  tone: races.length ? "win" : "lose",
                },
                {
                  k: "集成（TX-Oracle）",
                  v: lgbRaces ? `啟用 · ${lgbRaces} 場` : "未啟用（純天喜ELO）",
                  tone: lgbRaces ? "win" : "lose",
                },
                { k: "賠率快照", v: oddsRaces ? `已接入 ${oddsRaces} 場` : "等待開盤", tone: oddsRaces ? "win" : "lose" },
                { k: "天喜ELO 就緒", v: eng?.eloReady ? "是" : "否", tone: eng?.eloReady ? "win" : "lose" },
                { k: "近 90 日評核", v: `${r90?.meetingsEvaluated ?? 0} 日 / ${r90?.racesEvaluated ?? 0} 場` },
                { k: "評核更新", v: r90?.generatedAt ? new Date(r90.generatedAt).toLocaleString("zh-HK") : "—" },
              ]}
            />
          </div>
        </div>
      </Card>

      <CloseGapPanel />

      </TierGate>

      <TieredDayCards />

      <Card title="滾動表現" en="Rolling 90d">
        {rollup.isLoading ? (
          <Loading />
        ) : (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <KpiTile
                label="四揀平均命中"
                en="Top4"
                value={num(r90?.top4AvgIntersect != null ? (Number(r90.top4AvgIntersect) / 4) * 100 : null, 1)}
                unit="%"
                ratio={ratioOf(r90?.top4AvgIntersect, 4)}
                tone="gold"
                sub={`平均 ${num(r90?.top4AvgIntersect, 2)}／4 匹 · ${r90?.racesEvaluated ?? 0} 場`}
                trend={per.map((p) => p.top4AvgIntersect)}
              />
              <KpiTile
                label="三甲平均命中"
                en="Top3"
                value={num(r90?.top3AvgIntersect != null ? (Number(r90.top3AvgIntersect) / 3) * 100 : null, 1)}
                unit="%"
                ratio={ratioOf(r90?.top3AvgIntersect, 3)}
                tone="gold"
                sub={`平均 ${num(r90?.top3AvgIntersect, 2)}／3 匹 · 任一中 ${num(r90?.top3AnyHitRate)}%`}
                trend={per.map((p) => p.top3AvgIntersect)}
              />
            </div>
            <div className="tx-data-panel rounded-[8px] border border-deep/15 bg-paper p-2.5 shadow-sm">
              <div className="mb-1.5 flex items-baseline justify-between">
                <p className="text-[10px] font-bold text-ink-3">四揀平均命中匹數 · 逐個賽馬日（近 12 個月）</p>
                <p className="tabnum font-mono-tx text-[9px] text-ink-3">{per.length} 個賽馬日</p>
              </div>
              <TrendChart
                points={per.map((p) => ({ label: String(p.date || "").slice(5), value: p.top4AvgIntersect }))}
                height={124}
                decimals={2}
              />
              <p className="mt-1.5 text-[9px] leading-relaxed text-ink-3">金色虛線＝期內平均；圓點＝單個賽馬日平均命中匹數。</p>
            </div>
            <TierGate min="pro" feature="策略盈虧">
            <div className="rounded-[10px] border border-hairline bg-paper px-2.5 py-1.5">
              <p className="mb-1 text-[10px] font-bold text-ink-3">
                彩池命中 · 實戰複式（{pnlFrom} 起 · 命中場數／投注場數）
              </p>
              {[
                { k: "三重彩（依序首3 · 24 注 $240）", pool: "TIERCE" },
                { k: "四重彩（依序首4 · 24 注 $240）", pool: "QUARTET" },
              ].map((row) => {
                const b = pb?.[row.pool];
                const wins = b?.wins ?? null;
                const bets = b?.bets ?? null;
                const rate = wins != null && bets ? (wins / bets) * 100 : null;
                return (
                  <KV
                    key={row.k}
                    k={row.k}
                    v={rate == null ? "計算中" : `${num(rate)}% · ${wins}/${bets} 場`}
                  />
                );
              })}
              <p className="mt-1.5 text-[9px] leading-relaxed text-ink-3">
                以上按天喜策略實際落注方式計算：模型首 4 匹打複式（三重彩／四重彩為 24 注全包），只要實際頭三／頭四名落在模型首 4 匹之內即中。
              </p>
              <div className="mt-1.5 border-t border-hairline pt-1.5">
                <p className="mb-1 text-[10px] font-bold text-ink-3">
                  參考：單一組合命中（近 90 日 · 不打複式）
                </p>
                {[
                  { k: "位置Q（頭兩名入頭三）", rate: r90?.qpHitRate, hits: r90?.qpHits, n: r90?.racesEvaluated },
                  { k: "連贏（頭兩名不計次序）", rate: r90?.quinellaHitRate, hits: r90?.quinellaHits, n: r90?.racesEvaluated },
                  { k: "三重彩（首3 複式全中）", rate: r90?.trioHitRate, hits: r90?.trioHits, n: r90?.racesEvaluated },
                  { k: "四重彩（首4 複式全中）", rate: r90?.first4HitRate, hits: r90?.first4Hits, n: r90?.first4Eligible },
                ].map((row) => (
                  <KV
                    key={row.k}
                    k={row.k}
                    v={
                      row.hits == null && row.rate == null
                        ? "計算中"
                        : `${num(row.rate ?? 0)}% · ${row.hits ?? 0}/${row.n ?? 0}`
                    }
                  />
                ))}
              </div>
            </div>
            </TierGate>

          </div>
        )}
      </Card>

      <TierGate min="registered" feature="完整排行榜" mode="lock">
      <Card
        title="馬匹排行"
        en="Horse Leaderboard"
        action={
          <Seg
            value={board}
            onChange={setBoard}
            options={[
              { value: "elo", label: "天喜Elo" },
              { value: "wins", label: "勝場" },
              { value: "starts", label: "出賽" },
            ]}
          />
        }
      >
        {leaderboard.isLoading ? (
          <Loading />
        ) : leaderboard.error ? (
          <ErrorNote error={leaderboard.error} />
        ) : (
          <div>
            <p className="pb-1 text-[9px] text-ink-3">條長度＝勝率（100% 為滿格）；右方數字＝勝率。</p>
            {(leaderboard.data?.horses || []).map((h: any, i: number) => {
              const wr = h.totalStarts ? (h.totalWins / h.totalStarts) * 100 : null;
              return (
                <BarRow
                  key={h.id}
                  rank={i + 1}
                  label={
                    <Link to="/horse" search={{ id: h.id }} className="text-ink">
                      {h.nameCh || h.nameEn}
                    </Link>
                  }
                  value={wr ?? 0}
                  max={100}
                  fillRatio={(wr ?? 0) / 100}
                  tone={i === 0 ? "gold" : "gold"}
                  right={wr != null ? `${wr.toFixed(1)}%` : "—"}
                  sub={`天喜Elo ${num(h.elo, 0)} · ${h.totalWins ?? 0} 勝 / ${h.totalStarts ?? 0} 出賽`}
                />
              );
            })}
            {!(leaderboard.data?.horses || []).length ? <Empty /> : null}
          </div>
        )}
      </Card>

      <Card
        title="人馬榜"
        en="Jockeys / Trainers"
        action={
          <Seg
            value={people}
            onChange={setPeople}
            options={[
              { value: "jockeys", label: "騎師" },
              { value: "trainers", label: "練馬師" },
            ]}
          />
        }
      >
        {jockeys.isLoading || trainers.isLoading ? (
          <Loading />
        ) : (
          <Table head={["姓名", "出賽", "勝", "勝率", "三甲率"]}>
            {peopleRows.map((p: any, i: number) => {
              const starts = p.totalRides ?? p.totalRunners ?? 0;
              const top3Rate = p.top3Rate ?? (starts && p.top3 != null ? (p.top3 / starts) * 100 : null);
              return (
                <tr key={p.id} className={`border-b border-hairline ${i === 0 ? "bg-gold-bg/50" : ""}`}>
                  <Td first>
                    <span className="font-serif-tc font-bold">{p.nameCh || p.nameEn}</span>
                  </Td>
                  <Td>{starts}</Td>
                  <Td>{p.wins ?? 0}</Td>
                  <Td>{num(p.winRate)}%</Td>
                  <Td>{top3Rate != null ? `${num(top3Rate)}%` : "—"}</Td>
                </tr>
              );
            })}
            {!peopleRows.length ? (
              <tr>
                <td colSpan={5}>
                  <Empty />
                </td>
              </tr>
            ) : null}
          </Table>
        )}
      </Card>

      </TierGate>

      <Disclaimer />
    </AppShell>
  );
}

