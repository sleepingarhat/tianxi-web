import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { PaceBumpChart } from "@/components/tx/PaceBumpChart";
import { Card, Empty, ErrorNote, Loading, Pill } from "@/components/tx/ui";
import {
  getLabPace,
  getLabPaceForecast,
  type LabPaceForecastPayload,
  type LabPacePayload,
} from "@/lib/lab-pace.functions";
import {
  PACE_DISCLAIMER,
  deltaTone,
  forecastTone,
  formatDelta,
  formatSectionTime,
  roleTone,
  sectionLabel,
} from "@/lib/lab-pace-ui";

function SectionBars({ data }: { data: LabPacePayload }) {
  if (!data.sections.length) return <Empty label="無分段時間" />;
  return (
    <div className="space-y-2">
      {data.sections.map((s) => {
        const total = data.sections.length;
        const delta = s.deltaVsMedian;
        const tone = deltaTone(delta);
        return (
          <div key={s.sectionNumber} className="rounded-[6px] border border-hairline bg-paper-2 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-ink">
                {sectionLabel(s.sectionNumber, total)}
                {s.distance != null ? (
                  <span className="ml-1 font-mono-tx text-[10px] font-normal text-ink-3">{s.distance}m</span>
                ) : null}
              </span>
              <Pill tone={tone}>{formatDelta(delta)}</Pill>
            </div>
            <div className="mt-1.5 flex gap-3 font-mono-tx text-[11px] text-ink-2">
              <span>本場 {formatSectionTime(s.raceTime)}</span>
              <span>同班中位 {formatSectionTime(s.classMedian)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ForecastBlock({ data }: { data: LabPaceForecastPayload }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={forecastTone(data.forecast)}>節奏 {data.forecast}</Pill>
        <Pill tone="ink">{PACE_DISCLAIMER}</Pill>
      </div>
      <p className="text-[13px] leading-relaxed text-ink">{data.rationale}</p>
      <p className="text-[10px] text-ink-3">{data.rule}</p>

      <div>
        <p className="mb-1.5 text-[11px] font-bold text-ink-2">跑法組成</p>
        <div className="flex flex-wrap gap-1.5">
          {data.styleMix.buckets.map((b) => (
            <span
              key={b.code}
              className="rounded-[5px] border border-hairline bg-paper-2 px-2 py-1 font-mono-tx text-[10px] text-ink-2"
            >
              {b.label} {b.count}
              <span className="ml-1 text-ink-3">({Math.round(b.share * 100)}%)</span>
            </span>
          ))}
        </div>
      </div>

      {data.drawStyle.length ? (
        <div>
          <p className="mb-1.5 text-[11px] font-bold text-ink-2">檔位 × 跑法</p>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {data.drawStyle.map((c) => (
              <div
                key={`${c.draw}-${c.horseId}`}
                className="rounded-[5px] border border-hairline bg-paper-2 px-1.5 py-1 text-center"
                title={c.nameCh ?? undefined}
              >
                <div className="font-mono-tx text-[11px] font-bold text-ink">檔{c.draw}</div>
                <div className="truncate text-[9px] text-ink-3">{c.styleLabel}</div>
                <div className="truncate font-mono-tx text-[9px] text-ink-2">#{c.horseNumber ?? "—"}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** 排位頁「走位／節奏」內容；finished→pace，否則 forecast。 */
export function RacePacePanel({ raceId, finished }: { raceId: string; finished: boolean }) {
  const pace = useQuery({
    queryKey: ["lab-pace", raceId],
    queryFn: () => getLabPace({ data: { raceId } }),
    enabled: Boolean(raceId) && finished,
    staleTime: 60_000,
    retry: 1,
  });
  const forecast = useQuery({
    queryKey: ["lab-pace-forecast", raceId],
    queryFn: () => getLabPaceForecast({ data: { raceId } }),
    enabled: Boolean(raceId) && !finished,
    staleTime: 60_000,
    retry: 1,
  });

  if (finished) {
    if (pace.isLoading) return <Loading />;
    if (pace.error) return <ErrorNote error={pace.error} />;
    if (!pace.data) return <Empty label="無走位資料" />;
    const data = pace.data;
    const maxPos = Math.max(
      1,
      ...data.runners.flatMap((r) => r.positions.filter((p): p is number => p != null)),
      data.runners.length,
    );
    return (
      <div className="space-y-3">
        <Card
          title="沿途走位"
          en="Bump chart"
          action={
            <Link to="/lab/pace" search={{ raceId }} className="text-[11px] font-bold text-gold">
              研究室 →
            </Link>
          }
        >
          {data.notes.missingSectionals ? (
            <p className="mb-2 text-[10px] text-ink-3">{data.notes.missingSectionals}</p>
          ) : null}
          <PaceBumpChart
            runners={data.runners.map((r) => ({
              horseId: r.horseId,
              horseNumber: r.horseNumber,
              nameCh: r.nameCh,
              positions: r.positions,
              highlight: Boolean(r.highlight),
              roleLabel: r.roleLabel ?? null,
            }))}
            maxPos={maxPos}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.runners
              .filter((r) => r.highlight)
              .map((r) => (
                <Pill key={r.horseId} tone={roleTone(r.role)}>
                  #{r.horseNumber} {r.roleLabel ?? "—"}
                </Pill>
              ))}
          </div>
        </Card>

        <Card
          title="分段 vs 同班中位"
          en="Sectionals"
          action={
            data.paceIndex.label ? (
              <Pill tone={forecastTone(data.paceIndex.label)}>實況 {data.paceIndex.label}</Pill>
            ) : undefined
          }
        >
          <SectionBars data={data} />
        </Card>

        <p className="px-1 text-[10px] text-ink-3">
          {data.notes.disclaimer} · {data.notes.research}
        </p>
      </div>
    );
  }

  if (forecast.isLoading) return <Loading />;
  if (forecast.error) return <ErrorNote error={forecast.error} />;
  if (!forecast.data) return <Empty label="無節奏提示" />;
  return (
    <div className="space-y-3">
      <Card
        title="今場節奏提示"
        en="Pace forecast"
        action={
          <Link to="/lab/pace" search={{ raceId }} className="text-[11px] font-bold text-gold">
            研究室 →
          </Link>
        }
      >
        <ForecastBlock data={forecast.data} />
      </Card>
      <p className="px-1 text-[10px] text-ink-3">
        {forecast.data.disclaimer} · {forecast.data.researchNote}
      </p>
    </div>
  );
}
