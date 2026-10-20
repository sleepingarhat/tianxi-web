import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/tx/AppShell";
import {
  Card,
  Disclaimer,
  Empty,
  ErrorNote,
  Loading,
  PageHead,
  Pill,
} from "@/components/tx/ui";
import { HitStrip, KpiTile, KV } from "@/components/tx/viz";
import { fmtMeetingDate, num, txApi } from "@/lib/tx-api";
import { meetingCancellationForDate } from "@/lib/meeting-status";
import { resultsAudit } from "@/lib/results-audit";
import { FrozenEvidenceError, frozenEvidenceCodeOf, type FrozenEvidenceCode } from "@/lib/frozen-racing";
import { Button } from "@/components/ui/button";
import { RotateCw } from "lucide-react";

/** 彩池代號 → 中文（馬會標準簡稱） */
const POOL_ZH: Record<string, string> = {
  WIN: "獨贏", PLA: "位置", QIN: "連贏", QPL: "位置Q", CWA: "連贏（組合）",
  TRI: "三重彩", FCT: "四重彩", F_F: "四連環", TCE: "三T", DBL: "孖寶", TBL: "三寶", SIXUP: "六寶",
};

type DividendRow = { race_no: number; pool: string; combo: string; dividend: number; unit: number };

type Search = { date?: string | undefined };

export const Route = createFileRoute("/results")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    date: typeof search["date"] === "string" ? (search["date"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "賽果核對 · 天喜 TIANXI" },
      { name: "description", content: "每個賽馬日逐場核對引擎凍結預測與官方賽果，計算命中率與交集。" },
      { property: "og:title", content: "賽果核對 · 天喜 TIANXI" },
      { property: "og:description", content: "引擎預測 vs 官方賽果逐場核對。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResultsPage,
});

/** 缺證據唔係「載入失敗」：無副本／未核實要如實講明，等會員知唔使重試。 */
function EvidenceNote({ error }: { error: unknown }) {
  const code: FrozenEvidenceCode = frozenEvidenceCodeOf(error);
  const message = error instanceof Error ? error.message : "未知錯誤";
  if (code === "no-archive" || code === "not-verified") {
    return (
      <div className="rounded-[8px] border border-gold-strong/40 bg-gold-bg px-3 py-2.5">
        <p className="text-[11px] font-bold text-gold">{code === "no-archive" ? "呢個賽日未有原始凍結副本" : "呢個賽日嘅凍結副本未通過核實"}</p>
        <p className="mt-1 text-[10.5px] leading-relaxed text-ink-2">{message}</p>
        <p className="mt-1 text-[10px] leading-relaxed text-ink-3">天喜只展示有不可變原始副本嘅賽日，缺副本嘅賽日唔會用初版或臨場重算補寫；請揀選冇劃線嘅賽日核對。</p>
      </div>
    );
  }
  return <ErrorNote error={error} />;
}

function ResultsPage() {
  const { date } = Route.useSearch();
  const navigate = Route.useNavigate();

  const list = useQuery({ queryKey: ["meetings", 12], queryFn: () => txApi.meetings("?limit=12") });
  const meetings = (list.data?.meetings || []).filter((meeting) => !meetingCancellationForDate(meeting.date));
  const activeDate = date || meetings[1]?.date || meetings[0]?.date;

  // 存證目錄：只有建立咗不可變原始凍結副本嘅賽日先可以核對；呢份清單只講有無副本，唔代表戰績已驗收。
  const archive = useQuery({
    queryKey: ["frozen-archive-dates"],
    queryFn: async () => {
      const response = await fetch("/api/public/frozen-archive-dates", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      return new Set<string>(Array.isArray(data?.dates) ? data.dates : []);
    },
    staleTime: 10 * 60_000,
  });
  const archived = archive.data;

  const hr = useQuery({
    queryKey: ["verified-results-audit", activeDate],
    queryFn: async () => {
      if (!activeDate) throw new Error("未選賽日");
      const response = await fetch(`/api/public/frozen-racing?date=${encodeURIComponent(activeDate)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.frozen) throw new FrozenEvidenceError(data?.reason ?? "verification-failed", data?.error ?? "原凍結未能核實");
      return resultsAudit(data);
    },
    refetchInterval: 60_000,
    enabled: !!activeDate,
  });

  const s = hr.data?.summary;
  const races: any[] = hr.data?.races || [];

  // 派彩表（由賽馬後端賽後寫入；未有數據嘅賽日唔顯示呢區）
  const divQ = useQuery({
    queryKey: ["race-dividends", activeDate],
    queryFn: async () => (await import("@/lib/raceDividends")).fetchRaceDividends(activeDate ?? "") as Promise<DividendRow[]>,
    enabled: !!activeDate,
    staleTime: 10 * 60_000,
  });
  const divByRace = new Map<number, DividendRow[]>();
  for (const d of divQ.data ?? []) {
    const arr = divByRace.get(d.race_no) ?? [];
    arr.push(d);
    divByRace.set(d.race_no, arr);
  }

  return (
    <AppShell page="" ticker={activeDate ? `${fmtMeetingDate(activeDate)} 賽果核對` : "載入賽事…"}>
      <PageHead en="Results Audit" title="賽果核對" desc="引擎預測在賽前凍結，賽後與官方賽果逐場比對。" />

      <div className="no-scrollbar mx-4 flex gap-1 overflow-x-auto">
        {meetings.map((m) => {
          const on = m.date === activeDate;
          const hasArchive = archived ? archived.has(m.date) : true;
          return (
            <button
              key={m.id}
              type="button"
              title={hasArchive ? "有已核實嘅原始凍結副本" : "呢個賽日未有原始凍結副本，不能核對"}
              onClick={() => navigate({ search: { date: m.date } })}
              className={`tabnum shrink-0 rounded-[4px] border px-2 py-1 font-mono-tx text-[10px] font-bold ${
                on ? "border-gold-strong bg-gold-bg text-gold" : "border-hairline bg-paper text-ink-2"
              } ${hasArchive ? "" : "opacity-50 line-through"}`}
            >
              {m.date.slice(5)} {m.venue}
            </button>
          );
        })}
      </div>
      {archived && archived.size < meetings.length ? (
        <p className="mx-4 mt-1.5 text-[10px] leading-relaxed text-ink-3">
          劃線嘅賽日未有已核實嘅原始凍結副本，故唔會展示該日最終預測（唔會以初版或臨場重算補寫）。目前可核對嘅賽日：
          {[...archived].sort().reverse().slice(0, 6).join("、") || "暫無"}。
        </p>
      ) : null}

      <Card title="當日命中率" en="Hit Rate">
        {hr.isLoading ? (
          <Loading />
        ) : hr.error ? (
          <EvidenceNote error={hr.error} />
        ) : s ? (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <KpiTile
                label="四揀平均中"
                en="Top4 Avg"
                value={num(s.top4AvgIntersect, 2)}
                unit="／4"
                ratio={s.top4AvgIntersect != null ? Number(s.top4AvgIntersect) / 4 : null}
                tone={Number(s.top4AvgIntersect) >= 3 ? "win" : "gold"}
                sub={`${s.races} 場已評核 · ${s.excluded} 場未納入`}
                trend={races.map((r: any) => r.top4IntersectCount)}
              />
              <KpiTile
                label="前三平均中"
                en="Top3 Avg"
                value={num(s.top3AvgIntersect, 2)}
                unit="／3"
                ratio={s.top3AvgIntersect != null ? Number(s.top3AvgIntersect) / 3 : null}
                sub={`三甲任中 ${num(s.top3AnyHitRate)}% · ${s.top3AnyHits} 場`}
                trend={races.map((r: any) => r.top3IntersectCount)}
              />
            </div>
            <div className="rounded-[10px] border border-hairline bg-paper p-2.5">
              <p className="mb-1.5 text-[10px] font-bold text-ink-3">逐場四揀達標（≥3 匹）</p>
              <HitStrip hits={races.map((r: any) => (r.top4IntersectCount == null ? null : r.top4IntersectCount >= 3))} />
            </div>
            <div className="rounded-[10px] border border-hairline bg-paper px-2.5 py-1.5">
              <KV k="三重彩（頭三名複式）" v={`${num(s.trioHitRate)}% · ${s.trioHits} 場`} />
              <KV k="四重彩（頭四名複式）" v={`${num(s.first4HitRate)}% · ${s.first4Hits} 場`} />
              <KV k="凍結模型" v={races[0]?.scoreSource === "lgb" ? "天喜LGB" : races[0]?.scoreSource || "—"} />
              <KV k="集成比重" v={typeof races[0]?.ensembleAlpha === "number" ? `α=${Number(races[0].ensembleAlpha).toFixed(2)}` : "—"} />
            </div>
          </div>
        ) : (
          <Empty label="此日尚未核對" />
        )}
      </Card>

      <Card title="逐場核對" en="Per Race">
        {hr.isLoading ? (
          <Loading />
        ) : hr.error ? (
          <div><EvidenceNote error={hr.error} /><Button variant="outline" size="sm" onClick={() => hr.refetch()}><RotateCw />重新核對</Button></div>
        ) : races.length ? (
          <div className="divide-y divide-hairline">
            {races.map((r) => (
              <details key={r.raceNumber} open={Number(r.raceNumber) === 1} className="py-2.5">
                <summary className="flex cursor-pointer list-none items-center gap-2">
                  <span className="tabnum w-7 font-mono-tx text-[13px] font-bold text-gold">R{r.raceNumber}</span>
                  <span className="tabnum font-mono-tx text-[10px] text-ink-3">
                    {r.distance == null ? "途程待核" : `${r.distance}m`} · {r.going ?? "場地待核"}
                  </span>
                  <span className="ml-auto flex gap-1">
                    <Pill tone={(r.top4IntersectCount ?? 0) >= 3 ? "win" : "ink"}>
                      {r.officialMetric.eligible ? `原四揀中 ${r.top4IntersectCount}` : r.metricInput.status === "invalid-prelock-input" ? "鎖前輸入無效" : "待核，不計分"}
                    </Pill>
                    <Pill tone={r.top3AnyHit ? "win" : "ink"}>入頭三 {r.top3IntersectCount}</Pill>
                  </span>
                  <span className="text-[10px] text-ink-3">▼</span>
                </summary>
                {r.changeClassification.hasWithdrawal && <p className="mt-2 text-xs text-ink-2">退出場次 · 原凍結保留{r.officialMetric.eligible ? "並計正式戰績" : "，不計命中或場次分母"}</p>}
                {r.changeClassification.postLockJockeyChange && <p className="mt-2 text-xs text-ink-2">鎖後換騎 · 原四揀照計，不重算、不補位</p>}
                {r.effectiveTop4.substituted && <p className="mt-2 text-xs text-ink-2">補位四揀：{r.effectiveTop4.effective.join("－")} · 中 {r.officialMetric.alternativeHits ?? "待核"} 匹 · 臨場備選，不入正式戰績或盈虧</p>}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-[8px] border border-hairline bg-paper p-2">
                    <p className="mb-1 text-[10px] font-bold text-ink-3">引擎凍結四揀</p>
                    {(r.predictedTop4 || []).map((p: any) => (
                      <div key={p.horseNumber} className="flex items-center gap-1.5 py-0.5">
                        <span className="tabnum w-4 font-mono-tx text-[10px] font-bold text-gold">#{p.rank}</span>
                        <span className="tabnum w-5 rounded-[3px] bg-deep px-0.5 text-center font-mono-tx text-[10px] font-bold text-deep-fg">
                          {p.horseNumber}
                        </span>
                        {p.horseId ? <Link to="/horse" search={{ id: p.horseId }} className={`min-w-0 flex-1 truncate font-serif-tc text-[11px] ${p.hit ? "font-bold text-win" : "text-ink-2"}`}>{p.nameCh}</Link> : <span className={`min-w-0 flex-1 truncate font-serif-tc text-[11px] ${p.hit ? "font-bold text-win" : "text-ink-2"}`}>{p.nameCh}</span>}
                        <span className="shrink-0 font-mono-tx text-[10px]">{p.hit ? "✓" : "·"}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-[8px] border border-hairline bg-paper p-2">
                    <p className="mb-1 text-[10px] font-bold text-ink-3">官方頭四名</p>
                    {(r.actualTop4 || []).map((a: any) => (
                      <div key={a.horseNumber} className="flex items-center gap-1.5 py-0.5">
                        <span className="tabnum w-4 font-mono-tx text-[10px] font-bold text-ink-3">{a.position}</span>
                        <span className="tabnum w-5 rounded-[3px] bg-deep px-0.5 text-center font-mono-tx text-[10px] font-bold text-deep-fg">
                          {a.horseNumber}
                        </span>
                        {a.horseId ? <Link to="/horse" search={{ id: a.horseId }} className={`min-w-0 flex-1 truncate font-serif-tc text-[11px] ${a.hit ? "font-bold text-win" : "text-ink-2"}`}>{a.nameCh}</Link> : <span className={`min-w-0 flex-1 truncate font-serif-tc text-[11px] ${a.hit ? "font-bold text-win" : "text-ink-2"}`}>{a.nameCh}</span>}
                        <span className="tabnum shrink-0 font-mono-tx text-[10px] text-ink-3">{a.winOdds ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <Pill tone={r.trioHit ? "win" : "ink"}>三重彩</Pill>
                  <Pill tone={r.first4Hit ? "win" : "ink"}>四重彩</Pill>
                </div>
                {(divByRace.get(Number(r.raceNumber)) ?? []).length ? (
                  <div className="mt-1.5 rounded-[8px] border border-hairline bg-paper px-2 py-1.5">
                    <p className="mb-1 text-[10px] font-bold text-ink-3">官方派彩（每 ${divByRace.get(Number(r.raceNumber))?.[0]?.unit ?? 10} 注）</p>
                    <div className="grid grid-cols-2 gap-x-3 sm:grid-cols-3">
                      {(divByRace.get(Number(r.raceNumber)) ?? []).map((d, i) => (
                        <p key={i} className="tabnum flex items-baseline justify-between gap-1 font-mono-tx text-[10px] text-ink-2">
                          <span className="truncate">{POOL_ZH[d.pool] ?? d.pool} <span className="text-ink-3">{d.combo}</span></span>
                          <span className="shrink-0 font-bold text-ink">${Number(d.dividend).toLocaleString()}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </details>
            ))}
          </div>
        ) : (
          <Empty />
        )}
      </Card>

      <details className="mx-4 my-3 rounded-[10px] border border-hairline bg-paper-2">
        <summary className="cursor-pointer px-3 py-2.5 font-serif-tc text-[12px] font-bold text-ink">點樣讀賽果核對</summary>
        <div className="space-y-1 border-t border-hairline px-3 py-2.5 text-[10.5px] leading-relaxed text-ink-2">
          <p><b className="text-ink">四揀平均命中</b>：每場模型頭四匹，有幾多匹出現在官方頭四名，再取全日平均。</p>
          <p><b className="text-ink">三重彩</b>：模型排名頭三匹，複式覆蓋官方頭三名。</p>
          <p><b className="text-ink">四重彩</b>：模型排名頭四匹，複式覆蓋官方頭四名。</p>
        </div>
      </details>

      <Disclaimer />
    </AppShell>
  );
}
