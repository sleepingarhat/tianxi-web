import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/tx/AppShell";
import { Card, Empty, PageHead, Pill, Scroller, Stat, Table, Td } from "@/components/tx/ui";
import { getOfficialPools } from "@/lib/official-pools.functions";
import {
  CROSS_RACE_POOLS, DIVIDEND_KIND_LABEL, PROBE_LABEL, SELL_STATUS_LABEL, crossRaceDividends, dividendsByRace, hkd, poolLabel, raceSpan, summarizeStatus,
  type DividendRow, type ProbeRow,
} from "@/lib/official-pools";

type Search = { date?: string | undefined; venue?: "ST" | "HV" | undefined };

const poolsQuery = (s: Search) => queryOptions({
  queryKey: ["official-pools", s.date ?? null, s.venue ?? null],
  queryFn: () => getOfficialPools({ data: { date: s.date, venue: s.venue } }),
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/official-pools")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    date: typeof search["date"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(search["date"]) ? search["date"] : undefined,
    venue: search["venue"] === "ST" || search["venue"] === "HV" ? search["venue"] : undefined,
  }),
  loaderDeps: ({ search }) => ({ date: search.date, venue: search.venue }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(poolsQuery(deps)),
  head: () => ({
    meta: [
      { title: "官方派彩及彩池 · 天喜 TIANXI" },
      { name: "description", content: "香港賽馬會每個賽日嘅官方派彩、各彩池售票狀態、多寶及場地穿透儀／撞錘讀數，逐場逐關列出。" },
      { property: "og:title", content: "官方派彩及彩池 · 天喜 TIANXI" },
      { property: "og:description", content: "馬會官方派彩、彩池狀態同場地探針讀數存檔，按賽日查閱。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OfficialPoolsPage,
  errorComponent: OfficialPoolsError,
});

const VENUE = { ST: "沙田", HV: "跑馬地" } as const;
const CROSS = new Set<string>(CROSS_RACE_POOLS);
const NOTE = "馬會官方 · 只屬研究參考：派彩屬賽後事實，唔會用作預測或凍結輸入。";

function OfficialPoolsError({ reset }: { reset: () => void }) {
  return (
    <AppShell>
      <PageHead en="Official pools" title="官方派彩及彩池" desc={NOTE} />
      <div className="space-y-3 p-4">
        <p className="rounded-[6px] border border-hairline bg-paper p-3 text-[12px] text-ink-2">暫時讀唔到官方派彩存檔；呢個唔代表馬會冇公布派彩。</p>
        <button type="button" onClick={reset} className="text-sm font-bold text-gold underline">再試一次</button>
      </div>
    </AppShell>
  );
}

const hkTime = (iso: string) => {
  const m = /T(\d{2}:\d{2})/.exec(iso);
  return m ? m[1] : iso;
};
const hkStamp = (iso: string | null) => {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t + 8 * 3600_000).toISOString().slice(0, 16).replace("T", " ");
};

function Amount({ row }: { row: DividendRow }) {
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span className="font-bold text-ink">{hkd(row.per10)}</span>
      {row.partialUnit ? <span className="text-[10px] text-ink-3">原文 {hkd(row.amount)}／${row.partialUnit}</span> : null}
    </span>
  );
}

function ProbeCard({ probes }: { probes: ProbeRow[] }) {
  const times = [...new Set(probes.map((p) => p.time))];
  return (
    <Card title="場地探針讀數" en="Going probe">
      {!probes.length ? <Empty label="呢個賽日未有收錄探針讀數" /> : (
        <Table head={["時間", PROBE_LABEL.penetrometer, PROBE_LABEL.hammer]}>
          {times.map((t) => (
            <tr key={t}>
              <Td first className="tabnum font-mono-tx">{hkTime(t)}</Td>
              <Td>{probes.find((p) => p.time === t && p.instrument === "penetrometer")?.reading ?? "—"}</Td>
              <Td>{probes.find((p) => p.time === t && p.instrument === "hammer")?.reading ?? "—"}</Td>
            </tr>
          ))}
        </Table>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-ink-3">讀數照錄馬會原文（香港時間）。穿透儀讀數越高代表場地越軟；撞錘讀數越高代表場地越硬。</p>
    </Card>
  );
}

function StatusCard({ status, scrapedAt, past }: { status: ReturnType<typeof summarizeStatus>; scrapedAt: string | null; past: boolean }) {
  if (!status.pools.length) return <Card title="彩池狀態" en="Pool status"><Empty label="呢個賽日未有收錄彩池狀態" /></Card>;
  const multi = (pool: string) => status.featured.filter((x) => x.pool === pool).length > 1;
  return (
    <Card title="彩池狀態" en="Pool status">
      <div className="grid gap-x-4 sm:grid-cols-2">
        {status.pools.map((s) => (
          <div key={s.pool} className="flex min-w-0 items-center justify-between gap-2 border-b border-hairline/60 py-1.5 text-[12px]">
            <span className="font-bold text-ink">{poolLabel(s.pool)}</span>
            <span className="tabnum truncate font-mono-tx text-ink-2">
              {CROSS.has(s.pool) ? `${s.legs} 關` : `${s.races.length} 場`} · {Object.entries(s.counts).map(([k, n]) => `${SELL_STATUS_LABEL[k] ?? k} ${n}`).join("／")}
            </span>
          </div>
        ))}
      </div>
      {status.featured.length ? (
        <div className="mt-3">
          <Scroller>
            <Table head={["多寶彩池", "場次", "多寶", "預計派彩"]}>
              {status.featured.map((r) => (
                <tr key={`${r.pool}-${r.leg}`}>
                  <Td first><span className="font-bold">{poolLabel(r.pool)}</span>{multi(r.pool) ? <span className="ml-1 text-ink-3">第{r.leg}關</span> : null}</Td>
                  <Td>{r.races.join("、")}</Td>
                  <Td>{r.jackpot ? hkd(r.jackpot) : "—"}</Td>
                  <Td>{r.estimated ? hkd(r.estimated) : "—"}</Td>
                </tr>
              ))}
            </Table>
          </Scroller>
        </div>
      ) : null}
      {past && status.pools.some((s) => s.counts["START_SELL"]) ? (
        <p className="mt-2 rounded-[6px] border border-lose/30 bg-lose/5 px-2.5 py-1.5 text-[12px] text-lose">呢份係賽前收錄嘅狀態，完賽後未有再收錄，所以仍然顯示「開售中」。</p>
      ) : null}
      <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
        狀態係收錄嗰一刻嘅馬會公布{scrapedAt ? `（最後收錄 ${hkStamp(scrapedAt)} 香港時間）` : ""}，唔係即時售票狀態。多寶及預計派彩照錄馬會原文。
      </p>
    </Card>
  );
}

/** 連續場次（例如六環彩 1 至 6 場）縮寫為「1–6」，唔連續就逐場列出。 */
function legLabel(races: number[]): string {
  const contiguous = races.length > 2 && races.every((n, i) => i === 0 || n === (races[i - 1] ?? NaN) + 1);
  return contiguous ? `${races[0]}–${races[races.length - 1]}` : races.join("、");
}

/** 長組合（例如六環彩）喺每場分隔「/」後面換行，避免壓住派彩金額。 */
function ComboText({ combo }: { combo: string }) {
  const parts = combo.split(/(?<=\/)/);
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 ? <wbr /> : null}
        </span>
      ))}
    </>
  );
}

function CrossDividendCard({ rows }: { rows: DividendRow[] }) {
  if (!rows.length) return null;
  return (
    <Card title="跨場彩池派彩" en="Multi-race dividends">
      <Scroller>
        <Table head={["彩池", "場次", "勝出組合", "每 $10 派彩"]}>
          {rows.map((r) => (
            <tr key={`${r.pool}-${r.leg}-${r.kind}-${r.seq}-${r.combo}`}>
              <td className="px-1.5 py-1.5 text-left align-top">
                <span className="block whitespace-nowrap font-bold">{poolLabel(r.pool)}</span>
                {r.kind === "Winning" ? null : (
                  <span className="mt-1 inline-block whitespace-nowrap"><Pill>{DIVIDEND_KIND_LABEL[r.kind] ?? r.kind}</Pill></span>
                )}
              </td>
              <td className="tabnum whitespace-nowrap px-1.5 py-1.5 text-right align-top font-mono-tx">{legLabel(r.races)}</td>
              <td className="tabnum min-w-[6ch] max-w-[20ch] px-1.5 py-1.5 text-right align-top font-mono-tx leading-snug [overflow-wrap:anywhere]"><ComboText combo={r.combo} /></td>
              <td className="tabnum whitespace-nowrap py-1.5 pl-2 pr-1.5 text-right align-top font-mono-tx"><Amount row={r} /></td>
            </tr>
          ))}
        </Table>
      </Scroller>
    </Card>
  );
}

function RaceDividendsCard({ rows, past }: { rows: DividendRow[]; past: boolean }) {
  const races = dividendsByRace(rows);
  return (
    <Card title="逐場官方派彩" en="Race dividends">
      {!races.length ? <div className="tx-wide"><Empty label={past ? "呢個賽日已完賽，但官方派彩未收錄" : "呢個賽日未有收錄派彩（未完賽或未收料）"} /></div> : (
        <div className="tx-wide grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {races.map(({ race, pools }) => (
            <section key={race} className="min-w-0 rounded-[8px] border border-hairline bg-paper px-2.5 py-2">
              <h3 className="mb-1 font-serif-tc text-[14px] font-bold text-ink">第 {race} 場</h3>
              <table className="w-full text-[12px]">
                <tbody className="[&_tr]:border-b [&_tr]:border-hairline/60 [&_tr:last-child]:border-0">
                  {pools.flatMap(({ pool, rows: rs }) => rs.map((r, i) => (
                    <tr key={`${pool}-${r.seq}-${r.combo}`}>
                      <td className="whitespace-nowrap py-1 pr-2 font-bold text-ink-2">{i === 0 ? poolLabel(pool) : ""}</td>
                      <td className="tabnum py-1 pr-2 font-mono-tx leading-snug text-ink [overflow-wrap:anywhere]"><ComboText combo={r.combo} /></td>
                      <td className="tabnum py-1 text-right font-mono-tx"><Amount row={r} /></td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-ink-3">金額以每 $10 一注計；馬會以部分單位公布嘅派彩（例如四重彩每 $1）已按比例換算，並列出原文。</p>
    </Card>
  );
}

function hkToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function OfficialPoolsPage() {
  const search = Route.useSearch();
  const { data } = useSuspenseQuery(poolsQuery(search));
  const m = data.meeting;
  const status = summarizeStatus(data.status);
  const cross = crossRaceDividends(data.dividends);
  const top = data.dividends.reduce<DividendRow | null>((a, r) => (!a || r.per10 > a.per10 ? r : a), null);
  const jackpots = data.status.filter((r) => r.jackpot);
  const probeLatest = (k: "penetrometer" | "hammer") => [...data.probes].reverse().find((p) => p.instrument === k)?.reading ?? "—";
  const scrapedAt = data.status.reduce<string | null>((a, r) => (r.scrapedAt && (!a || r.scrapedAt > a) ? r.scrapedAt : a), null);
  // 賽日翌日（香港時間）起仍冇派彩，就唔係「未完賽」，要如實講未收錄。
  const past = Boolean(m && m.date < hkToday());
  const raceCount = new Set(data.dividends.filter((r) => r.races.length === 1).map((r) => r.races[0])).size;

  return (
    <AppShell>
      <PageHead en="Official pools" title="官方派彩及彩池" desc={NOTE} />
      <div className="mx-auto max-w-[1200px] pb-6">
        <div className="mx-4 mt-3 flex flex-wrap items-center gap-1.5">
          {data.meetings.slice(0, 12).map((x) => {
            const on = m && x.date === m.date && x.venue === m.venue;
            return (
              <Link key={`${x.date}-${x.venue}`} to="/official-pools" search={{ date: x.date, venue: x.venue }} aria-current={on ? "page" : undefined}
                className={`min-h-8 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-bold ${on ? "border-gold-strong bg-gold-bg text-gold" : "border-hairline bg-paper text-ink-2 hover:border-gold-strong/40"}`}>
                <span className="tabnum font-mono-tx">{x.date.slice(5)}</span> {VENUE[x.venue]}
              </Link>
            );
          })}
          <Link to="/results" className="ml-auto text-[12px] font-bold text-gold underline underline-offset-2">睇賽果 →</Link>
        </div>

        {!m ? <Card><Empty label={search.date ? `${search.date} 未有收錄官方派彩或彩池資料` : "未有已收錄嘅官方派彩"} /></Card> : (
          <>
            {data.failed.length ? <p className="mx-4 mt-3 rounded-[6px] border border-lose/30 bg-lose/5 px-3 py-2 text-[12px] text-lose">暫時讀唔到：{data.failed.join("、")}；其他部分照常顯示。</p> : null}
            <Card title={`${m.date} ${VENUE[m.venue]}`} en="Meeting summary" action={<Pill tone="gold">馬會官方</Pill>}>
              <div className="tx-wide grid grid-cols-2 gap-2 lg:grid-cols-4">
                <Stat label="已收派彩場數" value={raceCount || "—"} sub={`${data.dividends.length} 筆派彩`} />
                <Stat label="最高每 $10 派彩" value={top ? hkd(top.per10) : "—"} sub={top ? `${poolLabel(top.pool)} · ${raceSpan(top.races)}` : undefined} />
                <Stat label="多寶彩池" value={jackpots.length || "—"} sub={jackpots.length ? jackpots.map((j) => poolLabel(j.pool)).join("、") : "冇多寶"} />
                <Stat label="最新探針" value={probeLatest("penetrometer")} sub={`撞錘 ${probeLatest("hammer")}`} />
              </div>
            </Card>
            <RaceDividendsCard rows={data.dividends} past={past} />
            <div className="grid min-w-0 items-start lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              {cross.length ? <div className="min-w-0"><CrossDividendCard rows={cross} /></div> : null}
              <div className="min-w-0"><ProbeCard probes={data.probes} />{cross.length ? <StatusCard status={status} scrapedAt={scrapedAt} past={past} /> : null}</div>
              {cross.length ? null : <div className="min-w-0"><StatusCard status={status} scrapedAt={scrapedAt} past={past} /></div>}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
