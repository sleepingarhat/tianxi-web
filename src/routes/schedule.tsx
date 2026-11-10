import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AppShell } from "@/components/tx/AppShell";
import { MeetingCancellationNotice } from "@/components/tx/MeetingCancellationNotice";
import { MeetingDayPanel, MeetingStatusPills } from "@/components/tx/MeetingDayPanel";
import { Card, Disclaimer, Empty, ErrorNote, Loading, PageHead, Pill } from "@/components/tx/ui";
import { WeatherPanel } from "@/components/tx/WeatherPanel";
import { useMeetingCancellation } from "@/lib/meeting-status";
import { scheduleMonthTicker } from "@/lib/schedule-month";
import { fmtMeetingDate, txApi } from "@/lib/tx-api";

type Search = { month?: string | undefined; date?: string | undefined };

function yearMonth(value: unknown): string | undefined {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value) ? value : undefined;
}

function isoDate(value: unknown): string | undefined {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

export const Route = createFileRoute("/schedule")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    month: yearMonth(search["month"]),
    date: isoDate(search["date"]),
  }),
  head: () => ({
    meta: [
      { title: "賽馬日程 · 天喜 TIANXI" },
      { name: "description", content: "按月瀏覽香港賽馬日程。賽期、已報名、正式排位同賽果分開標示。" },
      { property: "og:title", content: "賽馬日程 · 天喜 TIANXI" },
      { property: "og:description", content: "按月瀏覽賽馬日程。已報名同正式排位分開顯示。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SchedulePage,
});

function SchedulePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { cancellation } = useMeetingCancellation();
  const smart = useQuery({ queryKey: ["smartCurrent"], queryFn: () => txApi.smartCurrent() });
  const baseMonth = (search.month || smart.data?.date || new Date().toISOString().slice(0, 10)).slice(0, 7);
  const [month, setMonth] = useState<string | null>(search.month ?? null);
  const ym = month || baseMonth;
  const openDate = search.date && search.date.startsWith(ym) ? search.date : null;

  const list = useQuery({
    queryKey: ["meetingsByMonth", ym],
    queryFn: () => txApi.meetingsByMonth(ym),
  });
  const detail = useQuery({
    queryKey: ["meeting", openDate],
    queryFn: () => txApi.meeting(openDate!),
    enabled: !!openDate,
    refetchInterval: 60_000,
  });
  const [pickedRace, setPickedRace] = useState<string | null>(null);

  function shiftMonth(delta: number) {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1 + delta, 1));
    const next = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    setMonth(next);
    setPickedRace(null);
    void navigate({ search: { month: next }, replace: true });
  }

  function toggleDate(date: string) {
    setPickedRace(null);
    void navigate({ search: { month: ym, date: openDate === date ? undefined : date }, replace: true });
  }

  const meetings = list.data?.meetings ?? [];
  const ticker = scheduleMonthTicker({
    ym,
    cancellationText: cancellation ? `${fmtMeetingDate(cancellation.date)} · ${cancellation.label}` : null,
    pending: list.isPending,
    failed: list.isError,
    meetingCount: meetings.length,
  });
  const races = detail.data?.date === openDate ? detail.data.races ?? [] : [];
  const activeRaceId = races.some((race) => race.id === pickedRace) ? pickedRace : races[0]?.id ?? null;
  const current = meetings.find((meeting) => meeting.date === smart.data?.date);

  return (
    <AppShell page="schedule" ticker={ticker}>
      <PageHead en="Fixtures" title="賽馬日程" desc="按月查看賽馬日。賽期、已報名、正式排位同賽果分開標示；檔位未公布唔會當成正式排位。" />

      {cancellation ? <MeetingCancellationNotice cancellation={cancellation} /> : null}

      <WeatherPanel />

      <div className="mx-4 flex items-center justify-between rounded-[8px] border border-hairline bg-paper-2 px-3 py-2">
        <button type="button" onClick={() => shiftMonth(-1)} className="text-[12px] font-bold text-ink-2">
          ← 上月
        </button>
        <span className="tabnum font-mono-tx text-[13px] font-bold text-ink">{ym}</span>
        <button type="button" onClick={() => shiftMonth(1)} className="text-[12px] font-bold text-ink-2">
          下月 →
        </button>
      </div>

      <Card title="賽馬日" en="Meetings" className="tx-wide">
        {list.isPending ? (
          <Loading />
        ) : list.isError ? (
          <ErrorNote error={list.error} />
        ) : meetings.length ? (
          <div className="divide-y divide-hairline">
            {meetings.map((meeting) => {
              const open = openDate === meeting.date;
              return (
                <div key={meeting.id}>
                  <button
                    type="button"
                    onClick={() => toggleDate(meeting.date)}
                    aria-expanded={open}
                    className="flex w-full flex-col gap-1 py-2.5 text-left"
                  >
                    <span className="flex items-center gap-2">
                      <span className="tabnum font-mono-tx text-[12px] font-bold text-gold">{meeting.date.slice(5)}</span>
                      <span className="min-w-0 flex-1 truncate font-serif-tc text-[13px] font-bold">{meeting.venueName}</span>
                      <span className="tabnum shrink-0 font-mono-tx text-[11px] text-ink-3">{meeting.totalRaces ? `${meeting.totalRaces} 場` : "場數待公布"}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <MeetingStatusPills meeting={meeting} />
                      <Pill>{meeting.trackCondition || "場地待公布"}</Pill>
                    </span>
                    {meeting.drawNote ? <span className="text-[12px] leading-relaxed text-ink-2">{meeting.drawNote}</span> : null}
                  </button>
                  {open ? (
                    detail.isLoading ? (
                      <Loading />
                    ) : detail.isError ? (
                      <ErrorNote error={detail.error} />
                    ) : detail.data ? (
                      <MeetingDayPanel meeting={detail.data} activeRaceId={activeRaceId} onRace={setPickedRace} />
                    ) : null
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <Empty label="此月份沒有賽馬日" />
        )}
      </Card>

      {smart.data && !cancellation ? (
        <Card title="當前賽事" en="Current">
          <p className="text-[12px] text-ink-2">
            {fmtMeetingDate(smart.data.date)} · {smart.data.venueName} · {smart.data.totalRaces} 場
          </p>
          {current ? (
            <div className="mt-2 space-y-1.5">
              <MeetingStatusPills meeting={current} />
              {current.drawNote ? <p className="text-[12px] leading-relaxed text-ink-2">{current.drawNote}</p> : null}
            </div>
          ) : null}
        </Card>
      ) : null}

      <Disclaimer />
    </AppShell>
  );
}
