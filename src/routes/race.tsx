import { FollowHorseButton } from "@/components/tx/FollowHorseButton";
import { useTier } from "@/lib/useTier";
import { UpgradeCard } from "@/components/tx/gates/UpgradeCard";
import { projectRacePicks } from "@/lib/tier-projection";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getTodayPicksAll } from "@/lib/picks.functions";
import { getPublicRacePage } from "@/lib/race-public.functions";
import { raceMetadata } from "@/lib/race-seo";
import { racePicksFromDay } from "@/lib/race-picks";


import { AppShell } from "@/components/tx/AppShell";
import { Card, Disclaimer, Empty, ErrorNote, Loading, PageHead, Pill, Silks } from "@/components/tx/ui";
import { canonicalRaceId, finishTime, fmtMeetingDate, txApi } from "@/lib/tx-api";

type Search = { id?: string | undefined };
const racePageQuery = (id: string) => queryOptions({
  queryKey: ["public-race-page", id],
  queryFn: () => getPublicRacePage({ data: { id } }),
  staleTime: 60_000,
});

export const Route = createFileRoute("/race")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    id: typeof search["id"] === "string" ? (search["id"] as string) : undefined,
  }),
  loaderDeps: ({ search }) => ({ id: canonicalRaceId(search.id) }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(racePageQuery(deps.id)),
  head: ({ loaderData }) => {
    const meta = raceMetadata(loaderData?.race);
    return {
    meta: [
      { title: meta.title },
      { name: "description", content: meta.description },
      { property: "og:title", content: meta.title },
      { property: "og:description", content: meta.description },
      { property: "og:url", content: meta.url },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: meta.url }],
    };
  },
  component: RacePage,
});

function RacePage() {
  const tier = useTier();
  const { id } = Route.useSearch();
  const raceId = canonicalRaceId(id);
  const { data: initial } = useSuspenseQuery(racePageQuery(raceId));
  const idMatch = raceId.match(/^race_(\d{4}-\d{2}-\d{2})_(ST|HV)_(\d+)$/);
  const raceDate = idMatch?.[1] ?? "";
  const raceNumber = idMatch ? Number(idMatch[3]) : 0;

  const next = useQuery({ queryKey: ["nextMeeting"], queryFn: () => txApi.nextMeeting(), enabled: !raceId, initialData: initial.next ?? undefined });
  const race = useQuery({
    queryKey: ["race", raceId],
    queryFn: () => txApi.race(raceId).catch(() => null),
    enabled: !!raceId,
  });
  // 未開賽的賽馬日：races 表可能未建，改由排位表（meetings）取馬匹、賠率、綵衣代碼
  const meeting = useQuery({
    queryKey: ["meeting", raceDate],
    queryFn: () => txApi.meeting(raceDate),
    enabled: !!raceDate,
    refetchInterval: 60_000,
  });
  const venueCode = idMatch?.[2] ?? "";
  const odds = useQuery({
    queryKey: ["odds", raceDate, venueCode, raceNumber],
    queryFn: () => txApi.odds(raceDate, venueCode, raceNumber).catch(() => null),
    enabled: !!raceDate && !!venueCode && !!raceNumber,
    refetchInterval: 60_000,
  });
  const fetchAllPicks = useServerFn(getTodayPicksAll);
  const dayPicks = useQuery({
    queryKey: ["todayPicksAll"],
    queryFn: () => fetchAllPicks(),
    staleTime: 60_000,
    enabled: !!raceId,
  });



  if (!raceId) {
    return (
      <AppShell columns={false} page="" ticker="請選擇一場賽事">
        <PageHead en="Race Card" title="排位表" desc="從下一個賽馬日選擇場次。" />
        <Card title="下一賽事場次" en="Select Race">
          {next.isLoading ? (
            <Loading />
          ) : (
            <div className="divide-y divide-hairline">
              {(next.data?.races || []).map((r) => (
                <Link key={r.id} to="/race" search={{ id: r.id }} className="flex items-center gap-2 py-2">
                  <span className="tabnum w-7 font-mono-tx text-[13px] font-bold text-gold">R{r.raceNumber}</span>
                  <span className="flex-1 truncate font-serif-tc text-[13px]">{r.title || `第 ${r.raceNumber} 場`}</span>
                  <span className="tabnum font-mono-tx text-[10px] text-ink-3">{r.distanceM || r.distance}m</span>
                </Link>
              ))}
              {!(next.data?.races || []).length ? <Empty /> : null}
            </div>
          )}
        </Card>
      </AppShell>
    );
  }

  const fallbackRace = (meeting.data?.races || []).find((r: any) => Number(r.raceNumber) === raceNumber);
  const d = race.data?.horses?.length || race.data?.entries?.length ? race.data : (fallbackRace ?? initial.race ?? race.data);
  const winOddsMap: Record<string, number> = odds.data?.winOdds || {};
  const plaOddsMap: Record<string, number> = odds.data?.plaOdds || {};
  const liveWin = (n: unknown) => winOddsMap[String(n).padStart(2, "0")] ?? null;
  const livePla = (n: unknown) => plaOddsMap[String(n).padStart(2, "0")] ?? null;
  const horses: any[] = d?.horses || d?.entries || [];
  // 引擎首選：只用已核實凍結／全日預測（同日同馬場），唔會用舊後端即時預測
  const dayRacePicks = projectRacePicks(racePicksFromDay(dayPicks.data, raceDate, venueCode, raceNumber), tier.tier);
  const pickRank = new Map<number, number>();
  dayRacePicks.forEach((p: any) => pickRank.set(Number(p.horseNumber), Number(p.rank)));
  const hasResult = horses.some((h) => h.finishingPosition);
  const loading = !horses.length && (race.isLoading || meeting.isLoading);


  return (
    <AppShell columns={false}
      page=""
      ticker={
        d
          ? `${fmtMeetingDate(d.date || raceDate)} · 第 ${d.raceNumber ?? raceNumber} 場 · ${d.going || ""}`
          : "載入中…"
      }
    >
      <PageHead
        en="Race Card"
        title={d ? `第 ${d.raceNumber ?? raceNumber} 場 ${d.title || ""}` : "排位表"}
        desc={d ? `${d.class || ""} · ${d.distance || d.distanceM || ""}m · ${d.course || ""}` : undefined}
      />

      <Card title="排位" en="Entries">
        {loading ? (
          <Loading />
        ) : !horses.length && race.error ? (
          <ErrorNote error={race.error} />
        ) : horses.length ? (

          <div className="-mx-3 -my-3 divide-y divide-hairline">
            {horses.map((h) => {
              const rank = pickRank.get(Number(h.horseNumber));
              const horseName = h.nameCh || h.name || "未命名";
              const horseLinkId = h.id || h.horseId;
              const facts = [
                ["檔位", h.draw ?? "—"],
                ["負磅", h.weight ?? h.declaredWeight ?? "—"],
                ["獨贏", liveWin(h.horseNumber) ?? h.winOdds ?? "—"],
                ["位置", livePla(h.horseNumber) ?? "—"],
                [hasResult ? "名次" : "評分", hasResult ? h.finishingPosition ?? "—" : h.rating ?? "—"],
                [hasResult ? "時間" : "配備", hasResult ? finishTime(h.finishTime) || "—" : h.gear || "—"],
              ];
              return (
                <article
                  key={h.id || h.horseNumber}
                  className={`px-3 py-3 ${rank === 1 ? "bg-gold-bg/45" : "bg-paper"}`}
                >
                  <div className="grid grid-cols-[46px_36px_minmax(0,1fr)_auto] items-center gap-2.5">
                    <Silks source={h} size={46} className="shadow-sm" />
                    <span className="tabnum grid h-9 w-9 shrink-0 place-items-center rounded-[5px] border border-gold-strong/55 bg-paper-2 font-mono-tx text-[15px] font-extrabold text-ink">
                      {h.horseNumber}
                    </span>
                    <div className="min-w-0 border-l border-hairline pl-2">
                      {horseLinkId ? (
                        <Link
                          to="/horse"
                          search={{ id: horseLinkId, raceId }}
                          className="block truncate font-serif-tc text-[16px] font-bold leading-tight text-ink"
                        >
                          {horseName}
                        </Link>
                      ) : (
                        <span className="block truncate font-serif-tc text-[16px] font-bold leading-tight text-ink">{horseName}</span>
                      )}
                      <p className="mt-1 truncate text-[10px] text-ink-3">
                        {h.jockeyCh || h.jockey || "—"} ／ {h.trainerCh || h.trainer || "—"}
                      </p>
                    </div>
                    <div className="flex min-w-9 items-center justify-end"><FollowHorseButton horseId={horseLinkId} horseName={horseName}/>{rank ? <Pill tone="gold">引擎 #{rank}</Pill> : null}</div>
                  </div>

                  <dl className="mt-2.5 grid grid-cols-6 overflow-hidden rounded-[6px] border border-hairline bg-paper-2">
                    {facts.map(([label, value], index) => (
                      <div key={label} className={`${index ? "border-l border-hairline" : ""} min-w-0 px-1 py-1.5 text-center`}>
                        <dt className="whitespace-nowrap text-[8px] font-bold text-ink-3">{label}</dt>
                        <dd className="tabnum mt-0.5 truncate font-mono-tx text-[11px] font-bold text-ink">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty label="此場尚無排位資料" />
        )}
      </Card>

      <Card title="引擎首選" en="Engine Picks">
        {dayPicks.isLoading ? (
          <Loading />
        ) : dayRacePicks.length ? (
          <div className="divide-y divide-hairline">
            {dayRacePicks.map((p: any) => (

              <div key={p.horseNumber} className="grid grid-cols-[26px_32px_minmax(0,1fr)_auto] items-center gap-2 py-2">
                <span className="tabnum w-6 font-mono-tx text-[12px] font-bold text-gold">#{p.rank}</span>
                <span className="tabnum grid h-8 w-8 place-items-center rounded-[5px] border border-gold-strong/55 bg-paper-2 font-mono-tx text-[13px] font-extrabold text-ink">
                  {p.horseNumber}
                </span>
                <span className="flex-1 truncate font-serif-tc text-[13px] font-bold">{p.nameCh}</span>
                <span className="tabnum font-mono-tx text-[11px] text-ink-2">
                  {tier.has("registered") && p.pWin != null ? `${(p.pWin * 100).toFixed(1)}%` : "—"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty label="尚未產生預測" />
        )}
      </Card>

      {!tier.loading && !tier.has("pro") ? <UpgradeCard need={tier.has("registered") ? "pro" : "registered"} feature={tier.has("registered") ? "完整引擎排名及機率" : "每場引擎首選及機率"} /> : null}
      <Disclaimer />
    </AppShell>
  );
}
