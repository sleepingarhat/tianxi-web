import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { PaceBumpChart } from "@/components/tx/PaceBumpChart";
import { AppShell } from "@/components/tx/AppShell";
import { FeaturePageGate } from "@/components/tx/gates/FeaturePageGate";
import {
  Card,
  Disclaimer,
  Empty,
  ErrorNote,
  Loading,
  PageHead,
  Pill,
} from "@/components/tx/ui";
import { getLabPace, getLabPaceForecast } from "@/lib/lab-pace.functions";
import {
  PACE_DISCLAIMER,
  deltaTone,
  forecastTone,
  formatDelta,
  formatSectionTime,
  roleTone,
  sectionLabel,
  validateRaceIdInput,
} from "@/lib/lab-pace-ui";
import { canonicalRaceId } from "@/lib/tx-api";

type Search = { raceId?: string; mode?: "auto" | "result" | "forecast" };

export const Route = createFileRoute("/lab/pace")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const out: Search = {};
    if (typeof search["raceId"] === "string") out.raceId = search["raceId"];
    if (search["mode"] === "result" || search["mode"] === "forecast" || search["mode"] === "auto") {
      out.mode = search["mode"];
    }
    return out;
  },
  head: () => ({
    meta: [
      { title: "走位節奏 · 研究室 · 天喜 TIANXI" },
      {
        name: "description",
        content: "分段時間、走位 bump chart、今場跑法組成同節奏研究提示（Pro；唔入官方四揀）。",
      },
      { property: "og:title", content: "走位節奏 · 天喜 TIANXI" },
      { property: "og:description", content: "Pro 研究室走位／節奏工具。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <FeaturePageGate min="pro" title="走位節奏">
      <PacePage />
    </FeaturePageGate>
  ),
});

function PacePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [draft, setDraft] = useState(search.raceId ?? "");
  const raceId = useMemo(() => {
    const raw = search.raceId?.trim() ?? "";
    if (!raw) return "";
    return canonicalRaceId(raw) || validateRaceIdInput(raw) || "";
  }, [search.raceId]);

  const mode = search.mode ?? "auto";

  const wantResult = mode === "result" || mode === "auto";
  const wantForecast = mode === "forecast" || mode === "auto";

  const pace = useQuery({
    queryKey: ["lab-pace", raceId],
    queryFn: () => getLabPace({ data: { raceId } }),
    enabled: Boolean(raceId) && wantResult,
    staleTime: 60_000,
    retry: false,
  });
  const forecast = useQuery({
    queryKey: ["lab-pace-forecast", raceId],
    queryFn: () => getLabPaceForecast({ data: { raceId } }),
    enabled: Boolean(raceId) && wantForecast,
    staleTime: 60_000,
    retry: false,
  });

  const hasFinishedSignal =
    pace.data != null &&
    pace.data.runners.some(
      (r) => r.finishingPosition != null || Boolean((r.runningPosition ?? "").trim()),
    );
  const showResult = mode === "result" || (mode === "auto" && hasFinishedSignal);

  const submit = () => {
    const id = validateRaceIdInput(draft);
    if (!id) return;
    const next: Search = { raceId: id };
    if (search.mode) next.mode = search.mode;
    void navigate({ search: next });
  };

  return (
    <AppShell page="lab" columns={false} wide ticker="走位節奏 · 研究提示・唔入排名">
      <PageHead
        en="Pace rhythm"
        title="走位節奏"
        desc="已完場：分段＋走位圖；今場：跑法組成同節奏研究提示"
      />

      <Card title="選擇場次" en="Race id">
        <div className="flex flex-wrap gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="race_YYYY-MM-DD_ST_1"
            className="min-w-[220px] flex-1 rounded-[6px] border border-hairline bg-paper-2 px-2.5 py-2 font-mono-tx text-[12px] text-ink"
          />
          <button
            type="button"
            onClick={submit}
            className="rounded-[6px] border border-gold-strong/55 bg-gold-bg px-3 py-2 text-[12px] font-bold text-ink"
          >
            載入
          </button>
          {raceId ? (
            <Link
              to="/race"
              search={{ id: raceId }}
              className="rounded-[6px] border border-hairline px-3 py-2 text-[12px] font-bold text-ink-2"
            >
              排位頁
            </Link>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(
            [
              ["auto", "自動"],
              ["result", "完場走位"],
              ["forecast", "今場節奏"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                const next: Search = { mode: k };
                if (search.raceId) next.raceId = search.raceId;
                void navigate({ search: next });
              }}
              className={`rounded-[5px] border px-2 py-1 text-[10px] font-bold ${
                (search.mode ?? "auto") === k
                  ? "border-gold-strong/55 bg-gold-bg text-ink"
                  : "border-hairline bg-paper-2 text-ink-2"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-ink-3">{PACE_DISCLAIMER} · 唔影響官方凍結四揀</p>
      </Card>

      {!raceId ? (
        <Card title="說明" en="Help">
          <Empty label="輸入 raceId 後載入；亦可由排位頁「走位／節奏」分頁進入" />
        </Card>
      ) : null}

      {raceId && (mode === "result" || mode === "auto") && pace.isLoading ? <Loading /> : null}
      {raceId && pace.error && mode === "result" ? <ErrorNote error={pace.error} /> : null}

      {showResult && pace.data ? (
        <>
          <Card
            title={`第 ${pace.data.meta.raceNumber ?? "—"} 場走位`}
            en={pace.data.meta.date}
            action={
              pace.data.paceIndex.label ? (
                <Pill tone={forecastTone(pace.data.paceIndex.label)}>實況 {pace.data.paceIndex.label}</Pill>
              ) : undefined
            }
          >
            <p className="mb-2 text-[11px] text-ink-2">
              {[pace.data.meta.venue, pace.data.meta.class, pace.data.meta.distance ? `${pace.data.meta.distance}m` : null, pace.data.meta.going]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {pace.data.notes.missingSectionals ? (
              <p className="mb-2 text-[10px] text-ink-3">{pace.data.notes.missingSectionals}</p>
            ) : null}
            <PaceBumpChart
              runners={pace.data.runners.map((r) => ({
                horseId: r.horseId,
                horseNumber: r.horseNumber,
                nameCh: r.nameCh,
                positions: r.positions,
                highlight: Boolean(r.highlight),
                roleLabel: r.roleLabel ?? null,
              }))}
              maxPos={Math.max(
                1,
                pace.data.runners.length,
                ...pace.data.runners.flatMap((r) => r.positions.filter((p): p is number => p != null)),
              )}
            />
            <div className="mt-3 divide-y divide-hairline">
              {pace.data.runners.map((r) => (
                <div key={r.horseId} className="flex items-center gap-2 py-1.5">
                  <span className="tabnum w-7 font-mono-tx text-[12px] font-bold text-gold">
                    #{r.horseNumber ?? "—"}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-serif-tc text-[13px] font-bold">
                    {r.nameCh ?? r.nameEn ?? r.horseId}
                  </span>
                  <span className="font-mono-tx text-[10px] text-ink-3">{r.runningPosition ?? "—"}</span>
                  <Pill tone={roleTone(r.role)}>{r.roleLabel ?? "未知"}</Pill>
                </div>
              ))}
            </div>
          </Card>

          <Card title="分段 vs 同班中位" en="Sectionals">
            {pace.data.sections.length ? (
              <div className="space-y-2">
                {pace.data.sections.map((s) => (
                  <div key={s.sectionNumber} className="rounded-[6px] border border-hairline bg-paper-2 px-2.5 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold">
                        {sectionLabel(s.sectionNumber, pace.data!.sections.length)}
                      </span>
                      <Pill tone={deltaTone(s.deltaVsMedian)}>{formatDelta(s.deltaVsMedian)}</Pill>
                    </div>
                    <div className="mt-1 font-mono-tx text-[11px] text-ink-2">
                      本場 {formatSectionTime(s.raceTime)} · 中位 {formatSectionTime(s.classMedian)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty label="無分段時間" />
            )}
          </Card>
        </>
      ) : null}

      {raceId && (mode === "forecast" || (mode === "auto" && !showResult)) ? (
        <>
          {forecast.isLoading ? <Loading /> : null}
          {forecast.error ? <ErrorNote error={forecast.error} /> : null}
          {forecast.data ? (
            <Card
              title="今場節奏提示"
              en="Pace forecast"
              action={<Pill tone={forecastTone(forecast.data.forecast)}>節奏 {forecast.data.forecast}</Pill>}
            >
              <div className="mb-2 flex flex-wrap gap-1.5">
                <Pill tone="ink">{PACE_DISCLAIMER}</Pill>
              </div>
              <p className="text-[13px] leading-relaxed text-ink">{forecast.data.rationale}</p>
              <p className="mt-1 text-[10px] text-ink-3">{forecast.data.rule}</p>

              <p className="mb-1.5 mt-3 text-[11px] font-bold text-ink-2">跑法組成</p>
              <div className="flex flex-wrap gap-1.5">
                {forecast.data.styleMix.buckets.map((b) => (
                  <span
                    key={b.code}
                    className="rounded-[5px] border border-hairline bg-paper-2 px-2 py-1 font-mono-tx text-[10px]"
                  >
                    {b.label} {b.count} ({Math.round(b.share * 100)}%)
                  </span>
                ))}
              </div>

              {forecast.data.drawStyle.length ? (
                <>
                  <p className="mb-1.5 mt-3 text-[11px] font-bold text-ink-2">檔位 × 跑法</p>
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                    {forecast.data.drawStyle.map((c) => (
                      <div
                        key={`${c.draw}-${c.horseId}`}
                        className="rounded-[5px] border border-hairline bg-paper-2 px-1.5 py-1 text-center"
                      >
                        <div className="font-mono-tx text-[11px] font-bold">檔{c.draw}</div>
                        <div className="truncate text-[9px] text-ink-3">{c.styleLabel}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              <div className="mt-3 divide-y divide-hairline">
                {forecast.data.runners.map((r) => (
                  <div key={r.horseId} className="flex items-center gap-2 py-1.5">
                    <span className="tabnum w-7 font-mono-tx text-[12px] font-bold text-gold">
                      #{r.horseNumber ?? "—"}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-serif-tc text-[13px] font-bold">
                      {r.nameCh ?? "—"}
                    </span>
                    <span className="text-[10px] text-ink-3">
                      {r.sampleCount ? `n=${r.sampleCount}` : "新馬／未知"}
                    </span>
                    <Pill tone={roleTone(r.style)}>{r.styleLabel}</Pill>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </>
      ) : null}

      <Disclaimer />
    </AppShell>
  );
}
