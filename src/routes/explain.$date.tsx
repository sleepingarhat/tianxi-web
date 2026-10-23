import { TierGate } from "@/components/tx/gates/TierGate";
import { explainTier } from "@/lib/tier-projection";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/tx/AppShell";
import { Card, Disclaimer, Empty, ErrorNote, PageHead, Pill, Stat, StatGrid } from "@/components/tx/ui";
import { TxBar } from "@/components/tx/viz";
import { EXPLAIN_DATES, VENUE_ZH, fixed, type ExplainRace } from "@/lib/explain-data";
import { useExplainMeeting } from "@/lib/explain-live";
import { useCoverageAudit } from "@/components/tx/CoverageAudit";
import { Loading } from "@/components/tx/ui";
import { LivePickEvidence } from "@/components/tx/LivePickEvidence";
import { RacePositionMap } from "@/components/tx/RacePositionMap";

export const Route = createFileRoute("/explain/$date")({
  head: ({ params }) => {
    const title = `${params.date} 四揀逐場拆解 · 天喜 TIANXI`;
    return {
      meta: [
        { title },
        {
          name: "description",
          content: `${params.date} 賽日：逐場列出已鎖凍結四揀、實際頭 4 名同重疊匹數，只作覆蓋對帳，唔改排名。`,
        },
        { property: "og:title", content: title },
        { property: "og:description", content: "逐場凍結四揀 vs 實際頭 4，重疊幾匹一目了然。" },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: ExplainMeetingPage,
});

function overlapTone(n: number | null): "win" | "gold" | "lose" {
  if (n == null) return "gold";
  if (n >= 3) return "win";
  if (n <= 1) return "lose";
  return "gold";
}

function RaceBlock({ r }: { r: ExplainRace }) {
  const tone = overlapTone(r.overlap4);
  return (
    <Card
      title={`第 ${r.raceNumber} 場`}
      en={`R${r.raceNumber}`}
      action={
        <span
          className={`tabnum rounded-[4px] border px-1.5 py-[2px] font-mono-tx text-[10px] font-bold ${
            tone === "win"
              ? "border-win/40 bg-win/10 text-win"
              : tone === "lose"
                ? "border-lose/40 bg-lose/10 text-lose"
                : "border-gold-strong/40 bg-gold-bg text-gold"
          }`}
        >
          中 {r.overlap4 ?? "—"}／4
        </span>
      }
    >
      <p className="tabnum font-mono-tx text-[10px] text-ink-3">
        {r.distance ? `${r.distance}米` : "—"} · {r.band ?? "—"} · 地質 {r.going ?? "—"}
      </p>
      <TxBar ratio={(r.overlap4 ?? 0) / 4} tone={tone} height={5} className="mt-1.5" />

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <div className="min-w-0">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.12em] text-ink-3">凍結四揀</p>
          {r.picks.map((p) => (
            <div
              key={p.rank}
              className={`mb-1 rounded-[6px] border px-2 py-1.5 ${
                p.hitTop4 ? "border-win/40 bg-win/5" : "border-hairline bg-paper"
              }`}
            >
              <p className="flex items-baseline gap-1.5">
                <span className="tabnum font-mono-tx text-[10px] font-bold text-ink-3">{p.rank}</span>
                <span className="tabnum font-mono-tx text-[11px] font-bold text-ink">{p.horseNumber ?? "—"}</span>
                <span className="min-w-0 truncate font-serif-tc text-[11px] text-ink">{p.nameCh ?? "—"}</span>
                {p.hitTop4 ? <span className="ml-auto shrink-0 text-[9px] font-bold text-win">入頭4</span> : null}
              </p>
              {p.reason ? (
                <p className="mt-1 text-[9px] leading-relaxed text-ink-3">{p.reason}</p>
              ) : null}
            </div>
          ))}
        </div>

        <div className="min-w-0">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.12em] text-ink-3">實際頭 4</p>
          {r.actualTop4.map((a) => (
            <div
              key={a.position}
              className={`mb-1 rounded-[6px] border px-2 py-1.5 ${
                a.inPicks ? "border-win/40 bg-win/5" : "border-hairline bg-paper"
              }`}
            >
              <p className="flex items-baseline gap-1.5">
                <span className="tabnum font-mono-tx text-[10px] font-bold text-ink-3">{a.position}</span>
                <span className="tabnum font-mono-tx text-[11px] font-bold text-ink">{a.horseNumber ?? "—"}</span>
                <span className="min-w-0 truncate font-serif-tc text-[11px] text-ink">{a.nameCh ?? "—"}</span>
              </p>
              <p className="tabnum mt-0.5 font-mono-tx text-[9px] text-ink-3">
                獨贏 {a.winOdds ?? "—"}
                {a.inPicks ? " · 四揀內" : " · 四揀外"}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {r.sixup_leg != null ? <Pill tone={r.sixup_leg ? "win" : "ink"}>六環單關 {r.sixup_leg ? "包到" : "未包"}</Pill> : null}
        <Pill tone={r.qin3 ? "win" : "ink"}>連贏膽三 {r.qin3 ? "包到" : "未包"}</Pill>
        <Pill tone={r.qpl3 ? "win" : "ink"}>位置Q三 {r.qpl3 ? "包到" : "未包"}</Pill>
        <Pill tone="ink">位置命中 {r.place3_hits ?? "—"}／3</Pill>
      </div>
      <p className="mt-1.5 font-mono-tx text-[9px] text-ink-3">來源 {r.src ?? "—"}</p>
      <div className="mt-3 border-t border-hairline pt-2">
        {r.picks.map(p => p.horseId ? <LivePickEvidence key={p.rank} raceId={`race_${r.date}_${r.venue}_${r.raceNumber}`} horseId={p.horseId} name={`#${p.horseNumber} ${p.nameCh}`} /> : null)}
      </div>
    </Card>
  );
}

function ExplainMeetingPage() {
  const { date } = Route.useParams();
  const { meeting: m, loading, error } = useExplainMeeting(date);
  const audit = useCoverageAudit();
  const need = explainTier(date, new Date(Date.now()+8*3600_000).toISOString().slice(0,10), Boolean(m?.races.length && m.races.every(r => r.actualTop4.length >= 4)));
  const dates = audit.data?.meetings.map(m => m.date) ?? EXPLAIN_DATES;

  if (loading) {
    return (
      <AppShell page="engine">
        <PageHead en="EXPLAIN · MEETING" title={`${date} 拆解`} desc="讀取已入帳命中率資料…" />
        <Loading label="讀取中…" />
      </AppShell>
    );
  }

  if (!m) {
    return (
      <AppShell page="engine">
        <PageHead
          en="EXPLAIN · MEETING"
          title={`${date} 拆解`}
          desc="呢個賽日未有凍結拆解——未鎖或未有完整賽果嘅賽日一律唔出拆解，唔係故障。"
        />
        <Card title="可選賽日" en="AVAILABLE">
          <div className="flex flex-wrap gap-1.5">
            {dates.map((d) => (
              <Link
                key={d}
                to="/explain/$date"
                params={{ date: d }}
                className="rounded-[6px] border border-hairline bg-paper px-2 py-1.5 font-mono-tx text-[10px] font-bold text-ink hover:border-gold-strong"
              >
                {d}
              </Link>
            ))}
          </div>
          {error ? <ErrorNote error={error} /> : <Empty label="未有此賽日完整凍結四揀及賽果" />}
        </Card>
        <Disclaimer />
      </AppShell>
    );
  }

  const withOverlap = m.races.filter((r) => r.overlap4 != null);
  const avg = withOverlap.length
    ? withOverlap.reduce((a, r) => a + (r.overlap4 ?? 0), 0) / withOverlap.length
    : null;
  const full = withOverlap.filter((r) => (r.overlap4 ?? 0) >= 4).length;
  const three = withOverlap.filter((r) => (r.overlap4 ?? 0) === 3).length;

  return (
    <AppShell page="engine">
      <PageHead
        en="EXPLAIN · MEETING"
        title={`${m.date} ${VENUE_ZH[m.venue ?? ""] ?? m.venue ?? ""} 逐場拆解`}
        desc="每場列出已鎖凍結四揀同實際頭 4 名，綠框代表兩邊重疊。排名一律照凍結版本，呢頁唔會重算。"
      />

      <TierGate min={need} feature={need === "pro" ? "賽前拆解" : "賽後拆解"} mode="lock">
      <Card title="賽日主尺" en="MEETING">
        <StatGrid cols={3}>
          <Stat label="平均中匹數" value={fixed(avg)} sub={`／4 · ${withOverlap.length} 場`} />
          <Stat label="只中 3 匹" value={three} sub="場" />
          <Stat label="只中 4 匹" value={full} sub="場" />
        </StatGrid>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {dates.map((d) => (
            <Link
              key={d}
              to="/explain/$date"
              params={{ date: d }}
              className={`rounded-[6px] border px-2 py-1 font-mono-tx text-[10px] font-bold ${
                d === m.date ? "border-gold-strong bg-gold-bg text-gold" : "border-hairline bg-paper text-ink-2"
              }`}
            >
              {d}
            </Link>
          ))}
          <Link
            to="/explain"
            className="rounded-[6px] border border-hairline bg-paper px-2 py-1 font-mono-tx text-[10px] font-bold text-ink-2 hover:border-gold-strong"
          >
            全局分層
          </Link>
        </div>
      </Card>

      {m.races.map((r) => (
        <div key={r.raceNumber}>
          <RaceBlock r={r} />
          <details className="mx-4 mb-3 border-b border-hairline"><summary className="cursor-pointer py-2 text-[11px] font-bold text-gold">R{r.raceNumber} 賽前／賽後走位對照</summary>
            <RacePositionMap date={m.date} raceId={`race_${m.date}_${m.venue}_${r.raceNumber}`} distance={r.distance ?? 0} frozen picks={r.picks.flatMap(p => p.horseId && p.horseNumber != null ? [{ horseId: p.horseId, horseNumber: p.horseNumber, nameCh: p.nameCh ?? "", rank: p.rank }] : [])} />
          </details>
        </div>
      ))}

      </TierGate>
      <Disclaimer extra="逐場覆蓋對帳只反映四揀同實際頭 4 嘅重疊，唔代表某匹馬勝出嘅原因；逐匹紅綠因子要等引擎倉以同一版凍結模型計好先會顯示。" />
    </AppShell>
  );
}
