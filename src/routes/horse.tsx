import { useTier } from "@/lib/useTier";
import { TierGate } from "@/components/tx/gates/TierGate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { AppShell } from "@/components/tx/AppShell";
import {
  Card,
  Disclaimer,
  Empty,
  ErrorNote,
  Loading,
  PageHead,
  Pill,
  Silks,
  Stat,
  StatGrid,
} from "@/components/tx/ui";
import {
  canonicalHorseId,
  canonicalRaceId,
  finishTime,
  fmtMeetingDate,
  num,
  styleLabel,
  txApi,
} from "@/lib/tx-api";

import type { HorseResearchPayload } from "@/lib/racing-shapes";

type Search = { id?: string | undefined; raceId?: string | undefined };

export const Route = createFileRoute("/horse")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    id: typeof search["id"] === "string" ? (search["id"] as string) : undefined,
    raceId: typeof search["raceId"] === "string" ? (search["raceId"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "馬匹研究檔案 · 天喜 TIANXI" },
      { name: "description", content: "單匹馬的血統、現評、天喜Elo 走勢、表現切片、賽後分段與往績評語。" },
      { property: "og:title", content: "馬匹研究檔案 · 天喜 TIANXI" },
      { property: "og:description", content: "馬匹血統、現評、天喜Elo 走勢與全生涯表現切片。" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HorsePage,
});

/* ---------------- helpers ---------------- */
function has(v: unknown) {
  if (v == null) return false;
  const t = String(v).trim();
  return t !== "" && !/^[-—–]+$/.test(t) && !/^(?:n\/a|na|null|undefined)$/i.test(t);
}
function dist(v: unknown) {
  if (!has(v)) return "";
  const t = String(v).trim();
  return /^\d+(?:\.\d+)?$/.test(t) ? `${t}米` : t;
}
function money(v: unknown) {
  if (!has(v)) return "";
  const n = Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? `HK$${n.toLocaleString("en-HK", { maximumFractionDigits: 0 })}` : String(v);
}
function rate(v: unknown) {
  const n = Number(v);
  return has(v) && Number.isFinite(n) ? `${n.toFixed(1)}%` : "";
}
function listText(v: unknown) {
  return Array.isArray(v) ? v.filter(has).join("、") : v;
}
function sectionalText(list: unknown) {
  if (!Array.isArray(list) || !list.length) return "";
  return list
    .map((s: any) =>
      [
        has(s.sectionNumber) ? `第${s.sectionNumber}段` : "",
        has(s.sectionTime) ? `${s.sectionTime}秒` : "",
        has(s.positionAtSection) ? `位置 ${s.positionAtSection}` : "",
      ]
        .filter(has)
        .join(" · "),
    )
    .filter(has)
    .join("；");
}
const statusText = (s: unknown) =>
  s === "active" ? "現役" : s === "retired" ? "已退役" : has(s) ? String(s) : "";

function KV({ rows }: { rows: [string, unknown][] }) {
  const present = rows.filter((r) => has(r[1]));
  if (!present.length) return null;
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-[8px] border border-hairline">
      {present.map(([k, v], i) => (
        <div
          key={k}
          className={`min-w-0 border-hairline px-2.5 py-2 ${i % 2 === 0 ? "border-r" : ""} ${
            i < present.length - (present.length % 2 === 0 ? 2 : 1) ? "border-b" : ""
          }`}
        >
          <p className="text-[9px] leading-none text-ink-3">{k}</p>
          <p className="mt-1 break-words text-[12.5px] font-medium text-ink">{String(v)}</p>
        </div>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-start gap-4 border-t border-hairline py-[7px] text-[11.5px] first:border-t-0">
      <span className="shrink-0 whitespace-nowrap text-ink-2">{label}</span>
      <span className="tabnum min-w-0 flex-1 break-words text-right font-mono-tx text-[10.5px] font-bold leading-relaxed text-ink">{value}</span>
    </div>
  );
}

function Metric({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[8px] border border-hairline bg-paper px-2.5 py-2">
      <h4 className="mb-1 font-serif-tc text-[12.5px] font-bold text-ink">{title}</h4>
      {children}
    </div>
  );
}

function Spark({ history }: { history: any[] }) {
  const pts = history.map((h) => Number(h.rating)).filter(Number.isFinite);
  if (pts.length < 2) return null;
  const slice = history.slice(-28);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  return (
    <div className="mt-2 flex h-[46px] items-end gap-[3px] border-b border-hairline">
      {slice.map((h, i) => {
        const r = Number(h.rating);
        const pctH = max > min ? 22 + ((r - min) / (max - min)) * 24 : 28;
        return (
          <i
            key={i}
            title={`${fmtMeetingDate(h.asOfDate)} · ${Math.round(r)}`}
            className="block min-w-[4px] flex-1 rounded-t-[2px] bg-gold/70"
            style={{ height: `${pctH}px` }}
          />
        );
      })}
    </div>
  );
}

/* ---------------- page ---------------- */
function HorsePage() {
  const tier = useTier();
  const [perfTab, setPerfTab] = useState("distance");
  const { id, raceId } = Route.useSearch();
  const horseId = canonicalHorseId(id);
  const rid = canonicalRaceId(raceId);

  const research = useQuery<HorseResearchPayload>({
    queryKey: ["horseResearchV2", horseId, rid],
    queryFn: async () => {
      const opts: Record<string, unknown> = { limit: 30, contract: "research-v2" };
      if (rid) opts["raceId"] = rid;
      const r: HorseResearchPayload & { data?: HorseResearchPayload | null } = await txApi.horseResearch(horseId, opts);
      return r && r.data && typeof r.data === "object" ? r.data : r;
    },
    enabled: !!horseId,
  });
  const styles = useQuery({
    queryKey: ["horseStyle", horseId, rid],
    queryFn: () => txApi.runningStyles([horseId], rid ? { raceId: rid } : {}),
    enabled: !!horseId,
  });
  const leaders = useQuery({
    queryKey: ["horseLeaderboard", "elo", "all"],
    queryFn: () => txApi.horseLeaderboard("elo", 12, "all"),
    enabled: !horseId,
  });

  if (!horseId) {
    return (
      <AppShell page="" ticker="請選擇一匹馬">
        <PageHead en="Horse Profile" title="馬匹研究檔案" desc="從評分榜或百科進入個別馬匹檔案。" />
        <Card title="天喜Elo 排行" en="Leaderboard">
          {leaders.isLoading ? (
            <Loading />
          ) : (
            <div className="divide-y divide-hairline">
              {(leaders.data?.horses || []).map((h: any) => (
                <Link key={h.id} to="/horse" search={{ id: h.id }} className="flex items-center gap-2 py-2">
                  <span className="flex-1 truncate font-serif-tc text-[13px] font-bold">{h.nameCh || h.nameEn}</span>
                  <span className="tabnum font-mono-tx text-[11px] text-ink-2">{num(h.elo, 0)}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
        <Disclaimer />
      </AppShell>
    );
  }

  const d = research.data || {};
  const h = d.horse || {};
  const rec = h.record || {};
  const elo = d.elo || {};
  const latestElo = elo.latest || {};
  const eloHistory: any[] = Array.isArray(elo.history) ? elo.history : [];
  const forms: any[] = Array.isArray(d.recentForm) ? d.recentForm : [];
  const perf = d.performance || {};
  const performanceRows = (key: string) => {
    const rows = perf[key];
    return Array.isArray(rows) ? rows : [];
  };
  const signals: any[] = Array.isArray(d.researchSignals) ? d.researchSignals : [];
  const training = d.training || {};
  const injuries: any[] = Array.isArray(d.health?.injuries) ? d.health.injuries : [];
  const meta = d.meta || {};
  const counts = meta.counts || {};
  const style = styleLabel(styles.data?.styles?.[0]);
  const trackworkRows: any[] = Array.isArray(training.trackwork) ? training.trackwork : [];
  const latestTrackwork = trackworkRows[0];
  const isNewHorse = Number(rec.totalStarts ?? 0) === 0;

  const perfGroups: [string, string][] = [
    ["distance", "途程"],
    ["distanceBucket", "途程分段"],
    ["track", "跑道"],
    ["going", "路況"],
    ["draw", "檔位"],
    ["jockey", "騎師"],
  ];

  return (
    <AppShell
      page=""
      ticker={
        h.nameCh
          ? `${h.nameCh} · ${h.code} · 天喜Elo ${tier.has("registered") ? num(latestElo.rating, 0) : "—"} · 現評 ${has(h.currentRating) ? h.currentRating : "—"}`
          : "載入馬匹資料…"
      }
    >
      {research.isLoading ? (
        <Loading label="整理馬匹檔案…" />
      ) : research.error ? (
        <div className="px-4 py-6">
          <ErrorNote error={research.error} />
          <button
            type="button"
            onClick={() => void research.refetch()}
            disabled={research.isFetching}
            className="mt-3 rounded-[8px] border border-hairline bg-paper-2 px-3 py-2 text-[12px] text-ink"
          >
            {research.isFetching ? "重新讀取中…" : "重試"}
          </button>
        </div>
      ) : (
        <>
          {/* HERO */}
          <section id="overview" className="border-b border-hairline bg-paper-2 px-4 pb-4 pt-5">
            <div className="flex items-start gap-3">
              <Silks source={h} size={60} className="rounded-[8px]" />
              <div className="min-w-0 flex-1">
                <p className="font-mono-tx text-[10px] font-bold uppercase tracking-[0.22em] text-gold">
                  HORSE DOSSIER{has(h.code) ? ` · ${h.code}` : ""}
                </p>
                <h1 className="mt-1 flex items-center gap-2 font-serif-tc text-[27px] font-bold leading-tight text-ink">
                  <span className="fx-spotlight">{h.nameCh || h.nameEn}</span>
                  {style ? <Pill tone="gold">{style}</Pill> : null}
                </h1>
                {has(h.nameEn) && h.nameEn !== h.nameCh ? (
                  <p className="mt-1 text-[11px] tracking-wide text-ink-3">{h.nameEn}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {statusText(h.status) ? <Pill>{statusText(h.status)}</Pill> : null}
                  {has(h.lastRaceDate) ? <Pill>最近出賽 {fmtMeetingDate(h.lastRaceDate)}</Pill> : null}
                  {has(h.currentRating) ? <Pill tone="gold">現評 {h.currentRating}</Pill> : null}
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono-tx text-[9px] tracking-[0.18em] text-ink-3">天喜ELO</p>
                <p className="tabnum font-mono-tx text-[24px] font-bold leading-none text-gold">
                  {tier.has("registered") ? num(latestElo.rating, 0) : "—"}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <StatGrid cols={4}>
                <Stat label="出賽" value={rec.totalStarts ?? "—"} />
                <Stat label="頭馬" value={rec.wins ?? "—"} />
                <Stat label="亞軍" value={rec.seconds ?? "—"} />
                <Stat label="季軍" value={rec.thirds ?? "—"} />
              </StatGrid>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(h.sire || h.pedigree?.sire) ? <Pill tone="gold">血統已收錄</Pill> : <Pill>血統待補</Pill>}
              {style ? <Pill>跑法 {style}</Pill> : null}
              {tier.has("registered") && latestTrackwork?.date ? <Pill>最近晨操 {fmtMeetingDate(latestTrackwork.date)}</Pill> : <Pill>晨操未有收錄</Pill>}
              {isNewHorse ? <Pill tone="gold">新馬 · 血統評分尚待回測</Pill> : null}
            </div>
          </section>

          <nav aria-label="馬匹檔案分段" className="no-scrollbar sticky top-0 z-20 flex gap-1 overflow-x-auto border-b border-hairline bg-paper/95 px-4 py-2 backdrop-blur-sm">
            {[["overview", "概覽"], ["elo", "天喜ELO"], ["splits", "表現"], ["form", "近績"], ["pedigree", "血統"], ["training", "晨操試閘"], ["source", "資料來源"]].map(([to, label]) => (
              <a key={to} href={`#${to}`} className="shrink-0 rounded-[4px] border border-hairline bg-paper px-2 py-1 text-[10px] font-bold text-ink-2">{label}</a>
            ))}
          </nav>

          {/* 身份及現況 */}
          <div id="pedigree" className="scroll-mt-12"><Card title="身份、血統及現況" en="Identity · Pedigree">
            <KV
              rows={[
                ["出生地", h.countryOfOrigin],
                ["毛色", h.colour],
                ["性別", h.sex],
                ["進口類別", h.importType],
                ["現任練馬師", h.currentTrainer],
                ["馬主", h.owner],
                ["父系", h.sire || h.pedigree?.sire],
                ["母系", h.dam || h.pedigree?.dam],
                ["外祖父", h.damSire || h.pedigree?.damSire],
                ["半兄弟姊妹", listText(h.halfSiblings)],
                ["現評", h.currentRating],
                ["季內獎金", money(h.seasonStakes)],
                ["生涯獎金", money(h.totalStakes)],
                ["最後出賽", has(h.lastRaceDate) ? fmtMeetingDate(h.lastRaceDate) : ""],
              ]}
            />
            {isNewHorse ? <p className="mt-2 rounded-[6px] border border-gold-strong/40 bg-gold-bg px-2.5 py-2 text-[10px] leading-relaxed text-ink-2">血統資料已接入；新馬血統起步評分仍在歷史回測，未影響現行生產排名。</p> : null}
          </Card></div>

          <TierGate min="registered" feature="Elo 走勢及研究信號" mode="preview" preview={<div className="mx-4 border-y border-hairline py-3 text-[11px] text-ink-3"><p>天喜Elo 起點：{eloHistory[0] ? num(eloHistory[0].rating, 0) : "—"}</p>{signals.slice(0, 1).map((s: any) => <p key={s.key}>{s.label || s.key}：{s.value}</p>)}</div>}>
          {/* 天喜Elo */}
          {has(latestElo.rating) ? (
            <div id="elo" className="scroll-mt-12"><Card title="天喜Elo 評分走勢" en="Latest 天喜Elo">
              <div className="rounded-[8px] border border-hairline bg-paper px-3 py-3">
                <div className="flex items-end justify-between gap-3">
                  <p className="tabnum font-serif-tc text-[34px] font-bold leading-none text-gold">
                    {num(latestElo.rating, 0)}
                  </p>
                  <p className="text-right text-[10.5px] leading-relaxed text-ink-3">
                    {has(latestElo.asOfDate) ? <>截至 {fmtMeetingDate(latestElo.asOfDate)}<br /></> : null}
                    {has(latestElo.gamesPlayed) ? `樣本 ${latestElo.gamesPlayed} 場` : null}
                    {eloHistory.length ? <><br />歷史點 {eloHistory.length}</> : null}
                  </p>
                </div>
                <Spark history={eloHistory} />
              </div>
            </Card></div>
          ) : null}

          {/* 研究信號 */}
          {signals.length ? (
            <Card title="研究信號" en="Research Signals">
              <div className="space-y-2">
                {signals.map((s: any) => (
                  <div key={s.key} className="rounded-[8px] border border-hairline bg-paper px-2.5 py-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[12px] font-bold text-ink">{s.label || s.key}</span>
                      <span className="tabnum font-mono-tx text-[13px] font-bold text-gold">
                        {s.value}
                        {has(s.unit) ? s.unit : ""}
                      </span>
                    </div>
                    <p className="mt-1 font-mono-tx text-[9.5px] text-ink-3">
                      {[
                        has(s.asOf) ? fmtMeetingDate(s.asOf) : "",
                        has(s.sampleSize) ? `樣本 ${s.sampleSize}` : "",
                        s.source,
                      ]
                        .filter(has)
                        .join(" · ")}
                    </p>
                    {has(s.explanation) ? (
                      <p className="mt-1 text-[10.5px] leading-relaxed text-ink-2">{s.explanation}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {/* 表現切片 */}
          {perfGroups.some(([k]) => performanceRows(k).length) ? (
            <div id="splits" className="scroll-mt-12"><Card title="表現切片" en="Performance Splits">
              <div className="space-y-2">
                <div className="no-scrollbar flex gap-1 overflow-x-auto pb-1">
                  {perfGroups.filter(([k]) => performanceRows(k).length).map(([k, label]) => (
                    <button key={k} type="button" onClick={() => setPerfTab(k)} className={`shrink-0 rounded-[4px] border px-2 py-1 text-[10px] font-bold ${perfTab === k ? "border-gold-strong bg-gold-bg text-gold" : "border-hairline bg-paper text-ink-2"}`}>{label}</button>
                  ))}
                </div>
                {perfGroups.map(([k, label]) => {
                  const rows: any[] = performanceRows(k);
                  if (!rows.length || k !== perfTab) return null;
                  return (
                    <Metric key={k} title={label}>
                      {rows.map((it: any) => {
                        const starts = Number(it.starts) || 0;
                        const wins = Number(it.wins) ?? Math.round(starts * (Number(it.winRate) || 0) / 100);
                        const top3 = Number(it.top3) ?? Math.round(starts * (Number(it.top3Rate) || 0) / 100);
                        return (
                          <Row
                            key={it.key || it.label}
                            label={it.label || it.key}
                            value={
                              starts > 0
                                ? `勝 ${wins}/${starts}場、三甲 ${top3}/${starts}場`
                                : "—"
                            }
                          />
                        );
                      })}
                      {rows.some((it: any) => Number(it.starts) < 20) ? (
                        <p className="mt-1.5 text-[9.5px] text-ink-3">樣本較少，解讀需審慎。</p>
                      ) : null}
                    </Metric>
                  );
                })}
              </div>
              {has(perf.note) ? <p className="mt-2 text-[10px] leading-relaxed text-ink-3">{String(perf.note)}</p> : null}
            </Card></div>
          ) : null}

          </TierGate>

          {/* 近期往績 */}
          <div id="form" className="scroll-mt-12"><Card
            title="近期往績"
            en="Post-race History"
            action={
              <span className="tabnum font-mono-tx text-[9.5px] text-ink-3">
                {forms.length ? `${forms.length} 場` : ""}
              </span>
            }
          >
            {forms.length ? (
              <div className="space-y-2">
                {forms.map((f: any, i: number) => {
                  const pos = has(f.positionText) ? f.positionText : f.position;
                  const p = Number(f.position);
                  const posCls = p === 1 ? "text-win" : p <= 3 ? "text-gold" : "text-ink";
                  const details: [string, unknown][] = [
                    ["日期", has(f.date) ? fmtMeetingDate(f.date) : ""],
                    ["賽事", [f.venue, has(f.raceNumber) ? `第${f.raceNumber}場` : ""].filter(has).join(" · ")],
                    ["班次", f.raceClass],
                    ["距離", dist(f.distance)],
                    ["路況", f.going],
                    ["跑道", [f.track, has(f.course) ? `"${f.course}" 賽道` : ""].filter(has).join(" ")],
                    ["檔位", f.draw],
                    ["馬號", f.horseNumber],
                    ["負磅", f.actualWeight],
                    ["騎師", f.jockey],
                    ["練馬師", f.trainer],
                    ["走位", f.runningPosition],
                    ["勝負距離", f.lbw],
                    ["完成時間", finishTime(f.finishTimeSec != null ? f.finishTimeSec : f.finishTime)],
                    ["獨贏賠率", f.winOdds],
                    ["配備", listText(f.gear)],
                    ["本場評分", f.rating],
                  ].filter((r) => has(r[1])) as [string, unknown][];
                  return (
                    <details
                      key={i}
                      open={i === 0}
                      className="overflow-hidden rounded-[8px] border border-hairline bg-paper"
                    >
                      <summary className="grid cursor-pointer list-none grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2.5 bg-paper-2 px-3 py-2.5">
                        <span className={`tabnum font-mono-tx text-[16px] font-bold ${posCls}`}>{pos ?? "—"}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-[12px] font-bold text-ink">
                            {[has(f.date) ? fmtMeetingDate(f.date) : "", f.venue, has(f.raceNumber) ? `第${f.raceNumber}場` : ""]
                              .filter(has)
                              .join(" · ")}
                          </span>
                          <span className="mt-[2px] block font-mono-tx text-[9.5px] text-ink-3">
                            {[dist(f.distance), f.raceClass, f.going].filter(has).join(" · ") || "POST-RACE HISTORY"}
                          </span>
                        </span>
                        <span className="tabnum font-mono-tx text-[9.5px] text-ink-3">
                          {has(f.winOdds) ? `賠 ${f.winOdds}` : ""}
                        </span>
                      </summary>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-[6px] border-t border-hairline px-3 py-2.5 text-[11px] leading-relaxed text-ink-2">
                        {details.map(([k, v]) => (
                          <p key={k}>
                            <b className="font-bold text-ink">{k}</b> {String(v)}
                          </p>
                        ))}
                      </div>
                      {tier.has("registered") && has(sectionalText(f.sectionals)) ? (
                        <p className="border-t border-hairline px-3 py-2 font-mono-tx text-[10px] leading-relaxed text-ink-2">
                          <b className="text-ink">分段</b> {sectionalText(f.sectionals)}
                        </p>
                      ) : null}
                      {has(f.comment) ? (
                        <p className="border-t border-hairline bg-gold-bg/40 px-3 py-2 text-[11px] leading-relaxed text-ink-2">
                          <b className="text-ink">賽後評語</b> {f.comment}
                        </p>
                      ) : null}
                    </details>
                  );
                })}
                <p className="pt-1 text-[9.5px] leading-relaxed text-ink-3">
                  以上為賽後歷史資料；檔位、負磅、騎師、配備、評語及分段不代表目前狀態。
                </p>
                {!tier.has("registered") ? <TierGate min="registered" feature="歷史分段" mode="preview" preview={forms[0] && has(sectionalText(forms[0].sectionals)) ? <p className="text-[11px] text-ink-3">{sectionalText(forms[0].sectionals).split(/[／|,，]/)[0]}</p> : null}>{null}</TierGate> : null}
              </div>
            ) : (
              <Empty label="尚無往績記錄" />
            )}
          </Card></div>

          <TierGate min="registered" feature="操練紀錄及傷患紀錄" mode="lock">
          {/* 操練 */}
          <div id="training" className="scroll-mt-12"><Card title="操練紀錄" en="Trackwork · Trials">
            <div className="space-y-2">
              {([["trackwork", "晨操"], ["barrierTrials", "試閘"]] as [string, string][]).map(([k, label]) => {
                const rows: any[] = Array.isArray(training[k]) ? training[k] : [];
                if (!rows.length) {
                  return (
                    <Metric key={k} title={label}>
                      <Row label="紀錄" value="未有收錄" />
                    </Metric>
                  );
                }
                return (
                  <Metric key={k} title={`${label}（近 ${rows.length} 次）`}>
                    {rows.map((it: any, i: number) => {
                      const detail = [
                        it.workType || it.batch,
                        it.venue,
                        dist(it.distance),
                        it.timeText || it.time,
                        has(it.splits) ? `分段 ${it.splits}` : "",
                        has(it.partner) ? `合操 ${it.partner}` : "",
                        it.rider,
                        it.placing,
                        it.gear,
                        it.position,
                        it.comment,
                      ]
                        .filter(has)
                        .filter((v, idx, arr) => arr.indexOf(v) === idx)
                        .join(" · ");
                      return (
                        <Row
                          key={i}
                          label={has(it.date) ? fmtMeetingDate(it.date) : "—"}
                          value={detail || "有出操（未有操練細節）"}
                        />
                      );
                    })}
                  </Metric>
                );
              })}
              <p className="pt-1 text-[9.5px] leading-relaxed text-ink-3">
                晨操只收錄現役馬匹；退役馬不會有新紀錄。踱步、游水等操練馬會不會公佈時間，故只列場地與類別；快操與試閘則附分段時間。
              </p>

            </div>
          </Card></div>


          {/* 傷患 */}
          {injuries.length ? (
            <Card title="傷患紀錄" en="Health">
              <div className="rounded-[8px] border-l-[3px] border-gold-strong border-y border-r border-y-hairline border-r-hairline bg-paper px-3 py-2 text-[11px] leading-relaxed text-ink-2">
                {injuries.map((it: any, i: number) => (
                  <p key={i}>
                    {[
                      has(it.date) ? fmtMeetingDate(it.date) : "",
                      it.type,
                      it.description,
                      it.status === "resolved" ? "已結束" : it.status === "ongoing" ? "跟進中" : it.status,
                      has(it.daysOut) ? `${it.daysOut}日` : "",
                    ]
                      .filter(has)
                      .join(" · ")}
                  </p>
                ))}
              </div>
            </Card>
          ) : null}

          </TierGate>

          {/* 資料方法及覆蓋 */}
          <div id="source" className="scroll-mt-12"><Card title="資料方法及覆蓋" en="Provenance">
            <div className="rounded-[8px] border-l-[3px] border-gold-strong border-y border-r border-y-hairline border-r-hairline bg-paper px-3 py-2.5 text-[10.5px] leading-relaxed text-ink-2">
              {Array.isArray(meta.sources) && meta.sources.length ? <p>來源：{meta.sources.join("、")}</p> : null}
              {has(meta.dataAsOf) ? <p>資料截至：{meta.dataAsOf}</p> : null}
              {has(meta.profile?.sourceUrl) ? (
                <p className="break-all">
                  公開來源：
                  <a href={meta.profile?.sourceUrl ?? undefined} target="_blank" rel="noopener noreferrer" className="text-gold underline">
                    {meta.profile?.sourceUrl}
                  </a>
                </p>
              ) : null}
              {(
                [
                  ["formStarts", "近期賽績"],
                  ["commentsRows", "賽後評語"],
                  ["eloHistoryPoints", "天喜Elo 歷史點"],
                  ["careerPerfStarts", "表現統計場次"],
                  ["sectionalsRows", "分段紀錄"],
                  ["trackworkSessions", "晨操紀錄"],
                  ["barrierTrials", "試閘紀錄"],
                  ["injuryRecords", "傷患紀錄"],
                ] as [string, string][]
              )
                .filter(([k]) => Number(counts[k]) > 0)
                .map(([k, label]) => (
                  <p key={k}>
                    {label}：{counts[k]}
                  </p>
                ))}
              {(Array.isArray(meta.coverageNotes) ? meta.coverageNotes : []).map((n: string, i: number) => (
                <p key={i}>{n}</p>
              ))}
              <p className="mt-1">近績、評語及分段屬賽後資料；缺少傷患或操練紀錄不代表沒有相關事件。</p>
            </div>
          </Card></div>
        </>
      )}

      <Disclaimer />
    </AppShell>
  );
}
