import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShareButton } from "@/components/tx/ShareCard";
import { exoticPoolOptions, winningSingleDividends } from "@/lib/racingPoolAccounting";
import { useEffect, useState } from "react";
import { isLegacyEvidenceDate } from "@/lib/evidence-cutoff";

import { AlphaGuard } from "@/components/tx/AlphaGuard";
import { AppShell } from "@/components/tx/AppShell";
import { Loading, Pill } from "@/components/tx/ui";
import { MeterBar } from "@/components/tx/viz";
import { entryVsActual } from "@/lib/entry-calibration";
import {
  canonicalHorseId,
  cleanTime,
  num,
  styleLabel,
  txApi,
  type RunningStyle,
} from "@/lib/tx-api";
import { supabase } from "@/integrations/supabase/client";
import { frozenComparison } from '@/lib/frozen-comparison';
import { Button } from '@/components/ui/button';

/** 彩池代號 → 中文（馬會標準簡稱） */
const POOL_ZH: Record<string, string> = {
  WIN: "獨贏", PLA: "位置", QIN: "連贏", QPL: "位置Q", CWA: "連贏（組合）",
  TRI: "三重彩", FCT: "四重彩", F_F: "四連環", TCE: "三T", DBL: "孖寶", TBL: "三寶", SIXUP: "六寶",
};

type DividendRow = { race_no: number; pool: string; combo: string; dividend: number; unit: number };

export const Route = createFileRoute("/prediction-vs-result")({
  head: () => ({
    meta: [
      { title: "預測與賽果 · 天喜 TIANXI" },
      {
        name: "description",
        content: "揀賽事日期同場次，並列比對天喜預測首 4 名與實際賽果首 4 名，同時出現嘅馬匹以金黃底標記。",
      },
      { property: "og:title", content: "預測與賽果 · 天喜 TIANXI" },
      { property: "og:description", content: "天喜預測首 4 名 vs 官方賽果首 4 名逐場並列比對。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComparePage,
});

type Horse = {
  horseId?: string | null;
  horse_id?: string | null;
  id?: string | null;
  horseNumber?: string | number | null;
  no?: string | number | null;
  nameCh?: string | null;
  name?: string | null;
  draw?: string | number | null;
  finishingPosition?: number | null;
};

function keyOf(h?: Horse | null) {
  if (!h) return null;
  if (h.horseId) return "h:" + h.horseId;
  if (h.horse_id) return "h:" + h.horse_id;
  if (h.id) return "h:" + h.id;
  const no = h.horseNumber ?? h.no;
  const nm = h.nameCh || h.name;
  if (no != null && no !== "" && nm) return `no:${no}|nm:${String(nm).trim().toLowerCase()}`;
  return null;
}

function rankColor(rank: number) { return rank === 1 ? "text-gold" : "text-ink-3"; }

function ComparePage() {
  const [date, setDate] = useState<string>("");
  const [raceId, setRaceId] = useState<string>("");

  const list = useQuery({ queryKey: ["meetings", 60], queryFn: () => txApi.meetings("?limit=60") });
  const meetings: any[] = list.data?.meetings || [];

  // 預設揀最近一個已過去（有賽果）嘅賽馬日
  useEffect(() => {
    if (date || !meetings.length) return;
    const today = new Date().toISOString().slice(0, 10);
    const found = meetings.find((m: any) => m.date <= today) || meetings[0];
    setDate(found.date);
  }, [meetings, date]);

  const meeting = useQuery({
    queryKey: ["meeting", date],
    queryFn: () => txApi.meeting(date),
    enabled: !!date,
    refetchInterval: 60_000,
  });
  const races: any[] = meeting.data?.races || [];

  useEffect(() => {
    if (!races.length) return;
    if (races.some((r: any) => String(r.id) === raceId)) return;
    setRaceId(String(races[0].id));
  }, [races, raceId]);

  const picks = useQuery({
    queryKey: ["topPicks", raceId],
    queryFn: () => txApi.topPicks(raceId),
    enabled: !!raceId,
  });
  const raceDetail = useQuery({
    queryKey: ["race", raceId],
    queryFn: () => txApi.race(raceId),
    enabled: !!raceId,
  });
  // 存檔預測（賽前鎖定版）：已有賽果嘅賽日一律以後端凍結紀錄為準，
  // 避免顯示事後重算版本，並可標明當日實際採用嘅集成比重 α。
  // 2026-10-21 起同「賽果核對」一樣，只用已核實原始凍結副本；之前嘅賽日照列舊紀錄並標明未核實。
  const legacy = isLegacyEvidenceDate(date);
  const frozen = useQuery({
    queryKey: ["pvr-frozen", date, legacy],
    queryFn: async (): Promise<any> => {
      if (legacy) return txApi.hitRate(date);
      const r = await fetch(`/api/public/frozen-racing?date=${encodeURIComponent(date)}`, { cache: "no-store" });
      const d: any = await r.json().catch(() => null);
      if (!r.ok) throw new Error('原凍結預測暫未能核實；紀錄不變，請稍後重新讀取。');
      return frozenComparison(d);
    },
    enabled: !!date,
  });
  const selectedRaceNumber = races.find((r: any) => String(r.id) === raceId)?.raceNumber;
  const frozenRaces: any[] = (frozen.data?.races || [])
    .slice()
    .sort((a: any, b: any) => Number(a.raceNumber) - Number(b.raceNumber));
  const frozenSummary: any = frozen.data?.summary && frozenRaces.length ? frozen.data.summary : null;
  const frozenRace = frozenRaces.find((r: any) => Number(r.raceNumber) === Number(selectedRaceNumber));
  const frozenTop4: Horse[] = (frozenRace?.predictedTop4 || []).slice(0, 4);

  // 官方派彩（每 $10 一注）：由賽馬後端賽後寫入；未有數據嘅賽日唔顯示
  const divQ = useQuery({
    queryKey: ["race-dividends", date],
    queryFn: async () => (await import("@/lib/raceDividends")).fetchRaceDividends(date) as Promise<DividendRow[]>,
    enabled: !!date,
    staleTime: 10 * 60_000,
  });
  const raceDividends = (divQ.data ?? []).filter((d) => Number(d.race_no) === Number(selectedRaceNumber));

  const left: Horse[] = frozenTop4.length
    ? frozenTop4
    : legacy && picks.data?.frozen === true ? (picks.data?.picks || []).slice(0, 4) : [];
  // 首選來源：後端逐匹回傳 scoreSource（lgb = 天喜LGB 融合模型；baseline／elo = 天喜ELO 基準）
  // 同一場可能部分馬匹退回基準，故以整場為準：有任何 lgb 即屬天喜LGB 排序。
  const pickSources = (frozenTop4.length ? frozenTop4 : picks.data?.picks || []).map((p: any) =>
    String(p?.scoreSource || ""),
  );
  const allSources = pickSources.length
    ? pickSources
    : [String(frozenRace?.scoreSource || picks.data?.scoreSource || "")];
  const anyLgb = allSources.some((s: string) => s.includes("lgb") || s.includes("oracle"));
  const allLgb = anyLgb && allSources.every((s: string) => s.includes("lgb") || s.includes("oracle"));
  // 當日實際採用嘅集成比重（α）：優先用後端凍結紀錄欄位，
  // 否則由凍結標籤／逐匹 scoreSource（例：tx-oracle-v3 (ensemble α=0.88)）解析。
  const frozenAlpha: number | null = (() => {
    const v = frozenRace?.ensembleAlpha;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    const texts = [String(frozenRace?.scoreSource || ""), ...pickSources];
    for (const t of texts) {
      const m = /α\s*=\s*([0-9.]+)/.exec(t);
      if (m) {
        const n = Number(m[1]);
        if (Number.isFinite(n)) return n;
      }
    }
    return null;
  })();

  const picksSourceLabel = allLgb
    ? "天喜LGB"
    : anyLgb
      ? "天喜LGB（部分退回天喜ELO）"
      : allSources.some(Boolean)
        ? "天喜ELO"
        : "天喜引擎";

  const right: Horse[] = ((raceDetail.data?.horses || []) as Horse[])
    .filter((h) => h?.finishingPosition != null && h.finishingPosition >= 1 && h.finishingPosition <= 4)
    .sort((a, b) => (a.finishingPosition ?? 9) - (b.finishingPosition ?? 9))
    .slice(0, 4);

  const styles = useQuery({
    queryKey: ["cmpStyles", raceId, left.length, right.length],
    queryFn: () =>
      txApi.runningStyles(
        [...left, ...right].map((h) => String(h.horseId || h.horse_id || h.id || "")),
        { raceId },
      ),
    enabled: !!raceId && (left.length > 0 || right.length > 0),
  });
  const styleMap: Record<string, RunningStyle> = {};
  for (const s of styles.data?.styles || []) styleMap[String(s.horseId)] = s;

  const leftKeys = new Set(left.map(keyOf).filter(Boolean) as string[]);
  const rightKeys = new Set(right.map(keyOf).filter(Boolean) as string[]);
  const isMatch = (h: Horse, other: Set<string>) => {
    const k = keyOf(h);
    return !!(k && other.has(k));
  };
  const hits = left.filter((h) => isMatch(h, rightKeys)).length;

  const m = meeting.data;
  const metaLine = !date
    ? ""
    : [
        date,
        m?.venueName || m?.venue,
        m?.trackCondition ? `場地 ${m.trackCondition}` : null,
        races.length ? `共 ${races.length} 場` : null,
      ]
        .filter(Boolean)
        .join(" · ");

  const loading = frozen.isLoading || raceDetail.isLoading;
  // 開跑時最終獨贏賠率：以賽事詳情（賽後）為準，按馬號對應
  const finalOdds: Record<string, number> = {};
  for (const x of (raceDetail.data?.horses || []) as Array<{ horseNumber?: unknown; winOdds?: unknown; finishingPosition?: unknown }>) {
    const o = Number(x?.winOdds);
    if (x?.horseNumber != null && Number.isFinite(o) && o > 0) finalOdds[String(x.horseNumber)] = o;
  }

  const exotic = useQuery(exoticPoolOptions(date));
  const wonDividends = winningSingleDividends(raceDividends, frozenTop4.map((h) => Number(h.horseNumber ?? h.no)));
  const wonExotic = (exotic.data?.pools ?? []).filter((p) => p.races.at(-1) === Number(selectedRaceNumber) && (p.payout > 0 || p.consPayout > 0));

  const Cell = ({ h, rank, matched }: { h: Horse; rank: number; matched: boolean }) => {
    const no = h.horseNumber ?? h.no;
    const nm = h.nameCh || h.name || "";
    const hid = canonicalHorseId(h.horseId || h.horse_id || h.id);
    const sl = styleLabel(styleMap[hid]);
    return (
      <div className={`grid min-h-[108px] flex-1 grid-cols-[20px_minmax(0,1fr)] items-start gap-2 border-b border-hairline px-2.5 py-3 last:border-b-0 ${matched ? "bg-gold-bg" : "bg-paper"}`}>
        <span className={`pt-5 text-center font-mono-tx text-[17px] font-bold ${rankColor(rank)}`}>{rank}</span>
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-1 text-[11px] text-ink-3">
            <span className="tabnum font-mono-tx font-bold">#{no}</span>
            {matched ? <span className="text-win" aria-label="同時入圍">✓</span> : null}
          </div>
          <div className="mt-1 break-words font-serif-tc text-[15px] font-bold leading-[1.5] text-ink">
            {hid ? <Link to="/horse" search={{ id: hid }}>{nm}</Link> : <span>{nm}</span>}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            {sl ? <span className="text-[12px] font-semibold text-ink-2">{sl === "放" ? "放頭" : sl === "前" ? "前置" : sl === "中" ? "居中" : sl === "後" ? "後上" : sl}</span> : <span />}
            {no != null && finalOdds[String(no)] ? <span title="開跑時最終獨贏賠率" className="tabnum whitespace-nowrap font-mono-tx text-[11px] text-ink-3">賠 <b className="text-ink-2">{finalOdds[String(no)]}</b></span> : null}
          </div>
        </div>
      </div>
    );
  };

  const EmptySide = ({ title }: { title: string }) => (
    <div className="px-4 py-6 text-center text-[12px] leading-relaxed text-ink-3">
      <strong className="mb-1 block text-[13px] text-ink-2">{title}</strong>
    </div>
  );

  return (
    <AppShell page="" ticker={metaLine || "載入賽事…"}>
      <section className="px-5 pb-2 pt-[22px]">
        <h1 className="font-serif-tc text-[24px] font-black leading-[1.15] tracking-[-0.005em] text-ink">
          <small className="mb-1.5 block font-mono-tx text-[10px] font-bold uppercase tracking-[0.22em] text-ink-3">
            Prediction vs Result
          </small>
          <span className="fx-spotlight block">預測與賽果</span>
        </h1>
        <p className="mt-2 text-[12px] leading-[1.55] text-ink-2">
          揀賽事日期同場次，比對天喜預測首 4 名同實際賽果首 4 名。左右兩邊同時出現嘅馬匹會用
          <b className="text-gold">金黃底</b>標記。
        </p>
      </section>

      <section className="grid grid-cols-2 gap-2.5 border-b border-hairline px-5 pb-3.5 pt-2">
        <div>
          <label htmlFor="cmp-date" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3">
            賽事日期
          </label>
          <select
            id="cmp-date"
            value={date}
            onChange={(e) => {
              setRaceId("");
              setDate(e.target.value);
            }}
            className="w-full appearance-none rounded-[10px] border border-hairline bg-paper-2 px-3 py-[10px] font-sans-tc text-[13px] font-semibold text-ink"
          >
            {meetings.length === 0 ? <option>載入中…</option> : null}
            {meetings.map((mm: any) => (
              <option key={mm.id ?? mm.date} value={mm.date}>
                {mm.date}
                {mm.venueName ? ` · ${mm.venueName}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="cmp-race" className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3">
            場次
          </label>
          <select
            id="cmp-race"
            value={raceId}
            disabled={!races.length}
            onChange={(e) => setRaceId(e.target.value)}
            className="w-full appearance-none rounded-[10px] border border-hairline bg-paper-2 px-3 py-[10px] font-sans-tc text-[13px] font-semibold text-ink disabled:opacity-60"
          >
            {races.length === 0 ? <option>請先揀日期</option> : null}
            {races.map((r: any) => {
              const t = cleanTime(r.startTime);
              return (
                <option key={r.id} value={String(r.id)}>
                  R{r.raceNumber}
                  {t ? ` · ${t}` : ""}
                  {r.distance ? ` · ${r.distance}m` : ""}
                </option>
              );
            })}
          </select>
        </div>
      </section>

      <div className="tabnum flex min-h-[18px] items-center justify-between gap-2 border-b border-hairline px-5 py-2 font-mono-tx text-[11px] tracking-[0.06em] text-ink-3">
        <span className="min-w-0 truncate">{metaLine}</span>
        <ShareButton
          className="border-gold/60 font-sans-tc text-gold hover:bg-gold-bg"
          spec={frozenTop4.length && right.length && selectedRaceNumber ? {
            kind: "result",
            date,
            venue: String(m?.venueName || m?.venue || ""),
            race: Number(selectedRaceNumber),
            meta: [m?.trackCondition ? `場地 ${m.trackCondition}` : null, races.find((r: any) => String(r.id) === raceId)?.distance ? `${races.find((r: any) => String(r.id) === raceId)?.distance}m` : null].filter(Boolean).join(" · "),
            hits,
            picks: frozenTop4.map((h) => {
              const f = right.find((r) => keyOf(r) && keyOf(r) === keyOf(h));
              return { no: String(h.horseNumber ?? h.no ?? ""), name: String(h.nameCh || h.name || ""), hit: !!f, finish: f?.finishingPosition ?? null };
            }),
            dayAvg: frozenSummary?.top4AvgIntersect != null ? num(frozenSummary.top4AvgIntersect, 2) : null,
            url: "https://tianxi.racing/prediction-vs-result",
          } : null}
        />
      </div>

      {/* 賽日總覽：主指標、彩池命中，同逐場命中導覽條 */}
      {frozenSummary ? (
        <section className="mx-4 mt-3 rounded-[12px] border border-hairline bg-paper-2 px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-serif-tc text-[13px] font-bold text-ink">
              賽日總覽
              <small className="ml-2 font-mono-tx text-[8px] uppercase tracking-[0.2em] text-ink-3">Meeting Recap</small>
            </p>
            <p className="tabnum font-mono-tx text-[10px] text-ink-3">{frozenSummary.racesEvaluated ?? 0} 場已評核</p>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <MeterBar
              label="四揀平均命中"
              en="Top4"
              value={`${num(frozenSummary.top4AvgIntersect, 2)}／4`}
              ratio={frozenSummary.top4AvgIntersect != null ? Number(frozenSummary.top4AvgIntersect) / 4 : null}
              tone="gold"
              sub="主指標"
            />
            <MeterBar
              label="三甲平均命中"
              en="Top3"
              value={`${num(frozenSummary.top3AvgIntersect, 2)}／3`}
              ratio={frozenSummary.top3AvgIntersect != null ? Number(frozenSummary.top3AvgIntersect) / 3 : null}
              tone="ink"
              sub="輔助指標"
            />
          </div>

          {/* 逐場命中導覽：撳一下即跳到該場並列比對 */}
          <div className="no-scrollbar -mx-0.5 mt-2.5 flex gap-1 overflow-x-auto px-0.5">
            {frozenRaces.map((fr: any) => {
              const rid = races.find((r: any) => Number(r.raceNumber) === Number(fr.raceNumber))?.id;
              const n = fr.top4IntersectCount == null ? null : Number(fr.top4IntersectCount);
              const on = Number(selectedRaceNumber) === Number(fr.raceNumber);
              const tone =
                n != null && n >= 3 ? "border-win bg-win/10 text-win" : n != null && n >= 2 ? "border-gold-strong bg-gold-bg text-gold" : "border-hairline bg-paper text-ink-3";
              return (
                <button
                  key={fr.raceNumber}
                  type="button"
                  disabled={!rid}
                  onClick={() => rid && setRaceId(String(rid))}
                  className={`shrink-0 rounded-[6px] border px-2 py-1 text-center transition-colors ${tone} ${
                    on ? "ring-1 ring-gold-strong" : ""
                  }`}
                >
                  <span className="block font-mono-tx text-[9px] font-bold leading-none">R{fr.raceNumber}</span>
                  <span className="tabnum mt-[3px] block font-mono-tx text-[11px] font-extrabold leading-none">{n == null ? '待核' : `${n}/4`}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* 集成比重健康：α 過低即代表天喜LGB 未真正影響排名 */}
      <div className="mx-4 mt-2">
        <AlphaGuard alpha={frozenAlpha} frozen={frozenTop4.length > 0} />
      </div>

      <div className="px-4 pb-[22px] pt-4">
        <div className="mx-auto grid max-w-[560px] lg:max-w-[900px] grid-cols-2 grid-rows-[auto_1fr] overflow-hidden rounded-[8px] border border-hairline bg-paper shadow-sm">
          <div className="border-b border-r border-hairline bg-paper-2 px-3 py-2.5 text-center font-serif-tc text-[16px] font-extrabold text-ink">
            預測
            <small className="mt-0.5 block font-mono-tx text-[10px] font-semibold text-ink-3">
              {picksSourceLabel}
              {frozenAlpha != null ? ` · α=${frozenAlpha.toFixed(2)}` : ""} · TOP 4
              <span className="mt-0.5 block font-sans-tc text-[9px] font-bold tracking-normal text-ink-3">
                {frozenTop4.length ? (legacy ? "舊紀錄，未經原始副本核實" : "已核實原始凍結副本") : "原凍結核對中"}
              </span>

            </small>
          </div>
          <div className="border-b border-hairline bg-paper-2 px-3 py-2.5 text-center font-serif-tc text-[16px] font-extrabold text-ink">
            賽果
            <small className="mt-0.5 block font-mono-tx text-[10px] font-semibold text-ink-3">
              Result · 1st – 4th
            </small>
          </div>
          <div className="flex min-w-0 flex-col border-r border-hairline" aria-label="預測首四名">
            {loading ? (
              <Loading />
            ) : left.length ? (
              left.map((h, i) => <Cell key={keyOf(h) || i} h={h} rank={i + 1} matched={isMatch(h, rightKeys)} />)
            ) : (
              <><EmptySide title={frozen.isError ? '原凍結暫未能核實，紀錄不變' : '未有可核實預測'} />{frozen.isError ? <Button variant="outline" className="mx-2 mb-3" onClick={()=>void frozen.refetch()}>重新讀取</Button> : null}</>
            )}
          </div>
          <div className="flex min-w-0 flex-col" aria-label="賽果首四名">
            {loading ? (
              <Loading />
            ) : right.length ? (
              right.map((h, i) => <Cell key={keyOf(h) || i} h={h} rank={i + 1} matched={isMatch(h, leftKeys)} />)
            ) : (
              <EmptySide title="賽果未出" />
            )}
          </div>
        </div>

        {left.length && right.length ? (
          <>
            <p className="tabnum mx-auto mt-[11px] max-w-[560px] lg:max-w-[900px] text-center font-mono-tx text-[12px] tracking-[0.04em] text-ink-2">
              預測首 4 名命中：
              <b className={`font-extrabold ${hits >= 2 ? "text-win" : "text-ink"}`}>{hits} / 4</b>
            </p>
            {wonDividends.length || wonExotic.length ? (
              <section aria-label="本場命中派彩" className="mx-auto mt-3 max-w-[560px] lg:max-w-[900px] border-t border-hairline pt-3">
                <h2 className="mb-2 text-[14px] font-bold text-ink">本場命中彩池 <span className="text-[11px] font-normal text-ink-3">每 $10 一注</span></h2>
                <div className="space-y-2">
                  {wonDividends.map((d, i) => <div key={i} className="flex items-center justify-between gap-3 rounded-[6px] border border-win/25 bg-win/5 px-3 py-2">
                    <div className="min-w-0"><b className="text-[13px] text-ink">{POOL_ZH[d.pool] ?? d.pool}</b><span className="ml-2 break-words font-mono-tx text-[11px] text-ink-3">{d.combo}</span></div>
                    <b className="tabnum shrink-0 font-mono-tx text-[14px] text-win">${d.dividend.toLocaleString()}</b>
                  </div>)}
                  {wonExotic.map((p) => <div key={p.name} className="rounded-[6px] border border-win/25 bg-win/5 px-3 py-2">
                    <div className="flex flex-wrap justify-between gap-2"><b className="text-[13px] text-ink">{p.name} · 第 {p.races.join("、")} 場</b><b className="tabnum font-mono-tx text-[14px] text-win">${(p.payout + p.consPayout).toLocaleString()}</b></div>
                    <p className="mt-1 text-[11px] text-ink-3">{p.payout ? `正獎 $${p.payout.toLocaleString()}` : ""}{p.consPayout ? ` 安慰獎 ${p.consUnits} 注 $${p.consPayout.toLocaleString()}` : ""}</p>
                    {p.races.some((r) => exotic.data?.legs[r]?.fifthFromLive) ? <p className="mt-1 text-[11px] text-gold">包含賽後補選，只作試算對照</p> : null}
                  </div>)}
                </div>
              </section>
            ) : null}
          </>
        ) : null}

        {(() => {
          const fin: Record<string, number> = {};
          for (const x of (raceDetail.data?.horses || []) as Array<{ horseNumber?: unknown; winOdds?: unknown; finishingPosition?: unknown }>) {
            const f = Number(x?.finishingPosition);
            if (x?.horseNumber != null && Number.isFinite(f) && f >= 1) fin[String(x.horseNumber)] = f;
          }
          const cmp = entryVsActual((picks.data?.picks || []) as import('@/lib/entry-rank').EntrySource[], fin);
          if (!cmp.rows.length) return null;
          return (
            <section aria-label="入場排名對實際成績" className="mx-auto mt-4 max-w-[560px] lg:max-w-[900px] rounded-[8px] border border-hairline bg-paper px-3 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-[14px] font-bold text-ink">入場排名 vs 實際成績</h2>
                <span className="shrink-0 font-mono-tx text-[9px] text-ink-3">{picks.data?.frozen === true ? "賽前鎖定機率" : "即時重算機率，只作參考"}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-[6px] bg-paper-2 py-2"><p className="text-[10px] text-ink-3">入場排名頭 {cmp.topCount} 匹 · 預期入 Q</p><b className="tabnum font-mono-tx text-[15px] text-gold">{cmp.expectedTop.toFixed(2)}</b><span className="mx-1 text-ink-3">對</span><b className="tabnum font-mono-tx text-[15px] text-win">{cmp.actualTop}</b><p className="text-[9px] text-ink-3">實際入 Q</p></div>
                <div className="rounded-[6px] bg-paper-2 py-2"><p className="text-[10px] text-ink-3">全場 {cmp.rows.length} 匹 · 預期入 Q</p><b className="tabnum font-mono-tx text-[15px] text-gold">{cmp.expectedAll.toFixed(2)}</b><span className="mx-1 text-ink-3">對</span><b className="tabnum font-mono-tx text-[15px] text-win">{cmp.actualAll}</b><p className="text-[9px] text-ink-3">實際入 Q</p></div>
              </div>
              <div className="mt-2 divide-y divide-hairline">
                <div className="grid grid-cols-4 py-1 font-mono-tx text-[9px] text-ink-3"><span>入場排名</span><span>馬號</span><span>入 Q 機率</span><span className="text-right">實際名次</span></div>
                {cmp.rows.map((r) => (
                  <div key={r.horseNumber} className={`tabnum grid grid-cols-4 py-1 font-mono-tx text-[11px] ${r.inQ ? "text-win" : "text-ink-2"}`}>
                    <span>#{r.entryRank}</span><span>{r.horseNumber}</span><span>{(r.pTop4 * 100).toFixed(1)}%</span><span className="text-right font-bold">{r.finish}{r.inQ ? " ✓" : ""}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[9px] leading-relaxed text-ink-3">單場樣本細，預期同實際有差屬正常；要睇長期係咪一致，需累積多場。只作對照，非投注建議。</p>
            </section>
          );
        })()}

        <p className="mx-auto mt-3 max-w-[560px] lg:max-w-[900px] px-2 text-center text-[11px] leading-[1.55] text-ink-3">
          <span className="mr-1 inline-block h-[10px] w-[14px] rounded-[2px] border border-gold-strong bg-gold-bg align-[-1px]" />
          同時出現於預測與賽果嘅馬匹
        </p>
      </div>


      <footer className="mx-5 mb-6 mt-[18px] border-t border-hairline pt-3.5 text-[11px] leading-[1.55] text-ink-3">
        <strong className="text-ink-2">天喜為分析平台，不提供投注服務。</strong>
        投注請透過合法渠道（HKJC）進行。此處顯示之預測、賽果、馬匹資料純屬分析展示，非投注建議。
      </footer>
    </AppShell>
  );
}
