import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { GoingHeatmap } from "@/components/tx/GoingHeatmap";
import { OptionListPicker } from "@/components/tx/OptionListPicker";
import { WeatherPanel } from "@/components/tx/WeatherPanel";
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
  Stat,
  StatGrid,
} from "@/components/tx/ui";
import { getLabGoing, getLabWeather } from "@/lib/lab-going.functions";
import {
  GOING_CONDITION_OPTIONS,
  GOING_COURSE_OPTIONS,
  GOING_DISCLAIMER,
  GOING_DISTANCE_OPTIONS,
  GOING_RESEARCH_NOTE,
  formatPp,
  formatRate,
  meetingListOptions,
  parseDistanceChoice,
  parseVenueInput,
} from "@/lib/lab-going-ui";
import { ensureListOption, filterListOptions } from "@/lib/option-list";
import { txApi } from "@/lib/tx-api";

type Search = {
  venue?: string;
  course?: string;
  distance?: number;
  going?: string;
  meetingId?: string;
};

export const Route = createFileRoute("/lab/going")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const out: Search = {};
    if (typeof search["venue"] === "string") out.venue = search["venue"];
    if (typeof search["course"] === "string") out.course = search["course"];
    if (typeof search["going"] === "string") out.going = search["going"];
    if (typeof search["meetingId"] === "string") out.meetingId = search["meetingId"];
    if (typeof search["distance"] === "number" && Number.isFinite(search["distance"])) {
      out.distance = Math.trunc(search["distance"]);
    } else if (typeof search["distance"] === "string" && /^\d+$/.test(search["distance"])) {
      out.distance = Number(search["distance"]);
    }
    return out;
  },
  head: () => ({
    meta: [
      { title: "場地天氣 · 功能 · 天喜 TIANXI" },
      {
        name: "description",
        content: "地況快照、檔位熱圖、跑法偏差、「今日合地」研究名單（Pro；歷史統計・唔入官方四揀）。",
      },
      { property: "og:title", content: "場地天氣 · 天喜 TIANXI" },
      { property: "og:description", content: "Pro 功能場地／天氣影響儀表板。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <FeaturePageGate min="pro" title="場地天氣">
      <GoingPage />
    </FeaturePageGate>
  ),
});

function GoingPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const [venueDraft, setVenueDraft] = useState(search.venue ?? "ST");
  const [courseDraft, setCourseDraft] = useState(search.course ?? "");
  const [distanceDraft, setDistanceDraft] = useState(
    search.distance != null ? String(search.distance) : "",
  );
  const [goingDraft, setGoingDraft] = useState(search.going ?? "");
  const [meetingDraft, setMeetingDraft] = useState(search.meetingId ?? "");
  const [courseQuery, setCourseQuery] = useState("");
  const [distanceQuery, setDistanceQuery] = useState("");
  const [goingQuery, setGoingQuery] = useState("");
  const [meetingQuery, setMeetingQuery] = useState("");
  const [focusDistance, setFocusDistance] = useState<number | null>(search.distance ?? null);

  const meetingsQ = useQuery({
    queryKey: ["lab-going-meetings"],
    queryFn: () => txApi.meetings("?limit=40"),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const venue = useMemo(() => parseVenueInput(search.venue ?? "ST") ?? "ST", [search.venue]);

  const goingQ = useQuery({
    queryKey: ["lab-going", search.venue, search.course, search.distance, search.going, search.meetingId],
    queryFn: () =>
      getLabGoing({
        data: {
          venue,
          course: search.course?.trim() || undefined,
          distance: search.distance,
          going: search.going?.trim() || undefined,
          meetingId: search.meetingId?.trim() || undefined,
        },
      }),
    staleTime: 60_000,
    retry: false,
  });

  const weatherQ = useQuery({
    queryKey: ["lab-weather", search.meetingId],
    queryFn: () => getLabWeather({ data: { meetingId: search.meetingId!.trim() } }),
    enabled: Boolean(search.meetingId?.trim()),
    staleTime: 60_000,
    retry: false,
  });

  const submit = () => {
    const v = parseVenueInput(venueDraft) ?? "ST";
    const next: Search = { venue: v };
    if (courseDraft.trim()) next.course = courseDraft.trim();
    const dist = parseDistanceChoice(distanceDraft);
    if (dist != null) next.distance = dist;
    if (goingDraft.trim()) next.going = goingDraft.trim();
    if (meetingDraft.trim()) next.meetingId = meetingDraft.trim();
    setFocusDistance(next.distance ?? null);
    void navigate({ search: next });
  };

  const data = goingQ.data;
  const pending = data?.filters.goingStatus === "pending" || data?.filters.goingStatus === "fallback";

  return (
    <AppShell page="lab" columns={false} wide ticker="場地天氣 · 歷史統計・研究層">
      <PageHead
        en="Going & weather"
        title="場地天氣"
        desc="快照、檔位熱圖、跑法偏差、「今日合地」研究名單"
      />

      <p className="mx-4 mb-2 text-[11px]">
        <Link to="/lab" className="text-ink-3 hover:text-gold">
          ← 功能
        </Link>
      </p>

      <Card title="過濾條件" en="Filters">
        <p className="mb-2 text-[11px] leading-relaxed text-ink-3">
          賽道、途程、地況同賽日都係清單揀選，唔使打內部編號。
        </p>
        <div className="mb-3">
          <label className="mb-1 block text-[11px] font-bold text-ink-2">馬場</label>
          <select
            value={venueDraft}
            onChange={(e) => setVenueDraft(e.target.value)}
            className="rounded-[4px] border border-hairline bg-paper px-2 py-1.5 text-[12px]"
            aria-label="馬場"
          >
            <option value="ST">沙田</option>
            <option value="HV">跑馬地</option>
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionListPicker
            label="賽道"
            query={courseQuery}
            onQueryChange={setCourseQuery}
            placeholder="搜賽道"
            options={filterListOptions(ensureListOption([...GOING_COURSE_OPTIONS], courseDraft), courseQuery)}
            selectedId={courseDraft}
            onSelect={setCourseDraft}
          />
          <OptionListPicker
            label="途程"
            query={distanceQuery}
            onQueryChange={setDistanceQuery}
            placeholder="搜途程"
            options={filterListOptions(
              distanceDraft
                ? ensureListOption([...GOING_DISTANCE_OPTIONS], distanceDraft, `${distanceDraft}m`)
                : [...GOING_DISTANCE_OPTIONS],
              distanceQuery,
            )}
            selectedId={distanceDraft}
            onSelect={setDistanceDraft}
          />
          <OptionListPicker
            label="地況"
            query={goingQuery}
            onQueryChange={setGoingQuery}
            placeholder="搜地況"
            options={filterListOptions(ensureListOption([...GOING_CONDITION_OPTIONS], goingDraft), goingQuery)}
            selectedId={goingDraft}
            onSelect={setGoingDraft}
          />
          <OptionListPicker
            label="賽日"
            query={meetingQuery}
            onQueryChange={setMeetingQuery}
            placeholder="搜日期或馬場"
            options={filterListOptions(
              ensureListOption(meetingListOptions(meetingsQ.data?.meetings ?? []), meetingDraft),
              meetingQuery,
            )}
            selectedId={meetingDraft}
            onSelect={setMeetingDraft}
            loading={meetingsQ.isLoading}
            emptyLabel={meetingsQ.isError ? "賽日清單暫時讀唔到" : "冇符合賽日"}
          />
        </div>
        <button
          type="button"
          onClick={submit}
          className="mt-3 rounded-[4px] border border-gold-strong/40 bg-gold-bg px-3 py-1.5 text-[12px] font-bold text-gold"
        >
          查詢
        </button>
      </Card>

      {/* 快照 */}
      <div className="mx-4 mt-3 grid gap-3 lg:grid-cols-2">
        <Card
          title="地況快照"
          en="Going snapshot"
          action={
            pending ? <Pill tone="ink">待公佈</Pill> : data?.filters.goingEffective ? (
              <Pill tone="gold">{data.filters.goingEffective}</Pill>
            ) : null
          }
        >
          {goingQ.isLoading ? (
            <Loading label="讀取地況統計…" />
          ) : goingQ.isError ? (
            <ErrorNote error={goingQ.error} />
          ) : data ? (
            <>
              <StatGrid cols={3}>
                <Stat
                  label="有效地況"
                  value={data.filters.goingEffective ?? "待公佈"}
                  sub={
                    data.filters.goingStatus === "fallback"
                      ? `沿用上次同場：${data.filters.fallbackGoing ?? "—"}`
                      : data.filters.goingStatus === "pending"
                        ? "地況待公佈"
                        : `自 ${data.filters.since}`
                  }
                />
                <Stat
                  label="歷史場數"
                  value={String(data.heatmap.totalRaces)}
                  sub={`${data.heatmap.totalRunners} 出賽紀錄`}
                />
                <Stat
                  label="平均三甲率"
                  value={formatRate(data.heatmap.avgTop3Rate)}
                  sub={data.notes.sparseRule}
                />
              </StatGrid>
              {data.notes.pendingGoing ? (
                <p className="mt-2 text-[11px] text-ink-3">
                  地況未公佈：顯示「{data.notes.pendingGoing}」
                  {data.filters.fallbackGoing ? `，統計暫用上次同場「${data.filters.fallbackGoing}」` : ""}。
                </p>
              ) : null}
            </>
          ) : (
            <Empty label="未有資料" />
          )}
        </Card>

        <div>
          <WeatherPanel venue={venue} />
          <p className="mt-1 text-[10px] text-ink-3">
            即時天氣失敗時只保留上方歷史統計。
            {search.meetingId ? " 下方為該賽日快照序列（若有）。" : " 揀賽日可睇該日快照序列。"}
          </p>
        </div>
      </div>

      {search.meetingId && (
        <Card title="賽日天氣序列" en="Meeting weather">
          {weatherQ.isLoading ? (
            <Loading label="讀取天氣快照…" />
          ) : weatherQ.isError ? (
            <ErrorNote error={weatherQ.error} />
          ) : weatherQ.data ? (
            <>
              {weatherQ.data.weatherError ? (
                <p className="mb-2 text-[11px] text-ink-3">{weatherQ.data.weatherError}</p>
              ) : null}
              <div className="mb-2 flex flex-wrap gap-1.5">
                <Pill>{weatherQ.data.meeting.date}</Pill>
                <Pill tone="deep">{weatherQ.data.meeting.venue}</Pill>
                <Pill tone={weatherQ.data.meeting.goingStatus === "pending" ? "ink" : "gold"}>
                  {weatherQ.data.meeting.goingDisplay ?? "—"}
                </Pill>
              </div>
              {weatherQ.data.snapshots.length === 0 ? (
                <Empty label="尚未有賽日天氣快照（migration 草稿／夜間寫入後先有）" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-ink-3">
                        <th className="py-1 text-left">時間</th>
                        <th className="py-1 text-right">氣溫</th>
                        <th className="py-1 text-right">濕度</th>
                        <th className="py-1 text-right">雨量</th>
                        <th className="py-1 text-right">風速</th>
                        <th className="py-1 text-right">土壤</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weatherQ.data.snapshots.map((s) => (
                        <tr key={s.ts} className="border-t border-hairline">
                          <td className="py-1">{s.ts}</td>
                          <td className="py-1 text-right">{s.temp ?? "—"}</td>
                          <td className="py-1 text-right">{s.rh ?? "—"}</td>
                          <td className="py-1 text-right">{s.rainMm ?? "—"}</td>
                          <td className="py-1 text-right">
                            {s.windKmh ?? "—"}
                            {s.windDir ? ` ${s.windDir}` : ""}
                          </td>
                          <td className="py-1 text-right">{s.soilMoisture ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </Card>
      )}

      <Card
        title="檔位熱圖"
        en="Draw heatmap"
       
        action={
          data && data.heatmap.distances.length > 1 ? (
            <select
              value={focusDistance ?? ""}
              onChange={(e) =>
                setFocusDistance(e.target.value ? Number(e.target.value) : null)
              }
              className="rounded-[4px] border border-hairline bg-paper px-2 py-1 text-[10px]"
              aria-label="聚焦途程"
            >
              <option value="">全部途程</option>
              {data.heatmap.distances.map((d) => (
                <option key={d} value={d}>
                  {d}m
                </option>
              ))}
            </select>
          ) : null
        }
      >
        {goingQ.isLoading ? (
          <Loading label="計算熱圖…" />
        ) : goingQ.isError ? (
          <ErrorNote error={goingQ.error} />
        ) : data ? (
          <GoingHeatmap
            draws={data.heatmap.draws}
            distances={data.heatmap.distances}
            cells={data.heatmap.cells}
            focusDistance={focusDistance}
          />
        ) : (
          <Empty label="未有熱圖" />
        )}
      </Card>

      <Card title="跑法偏差" en="Style bias">
        {goingQ.isLoading ? (
          <Loading label="計算跑法…" />
        ) : goingQ.isError ? (
          <ErrorNote error={goingQ.error} />
        ) : data ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data.styleBias.map((s) => (
              <div
                key={s.code}
                className={`rounded-[6px] border border-hairline p-2 ${s.sparse ? "opacity-50" : ""}`}
              >
                <p className="text-[11px] font-bold text-ink">{s.label}</p>
                <p className="mt-1 text-[16px] font-bold tabular-nums text-gold">
                  {formatRate(s.winRate)}
                </p>
                <p className="text-[10px] text-ink-3">
                  勝率 Δ {formatPp(s.deltaWinVsAvg)} · 三甲 {formatRate(s.top3Rate)}
                  {s.sparse ? " · 樣本不足" : ""}
                </p>
                <p className="text-[9px] text-ink-3">{s.runners} 出賽</p>
              </div>
            ))}
          </div>
        ) : (
          <Empty label="未有跑法統計" />
        )}
      </Card>

      <Card title="今日合地" en="Going suited">
        {goingQ.isLoading ? (
          <Loading label="篩選合地…" />
        ) : goingQ.isError ? (
          <ErrorNote error={goingQ.error} />
        ) : data?.suited?.length ? (
          <ul className="divide-y divide-hairline">
            {data.suited.map((h) => (
              <li key={h.horseId} className="flex flex-wrap items-center gap-2 py-2 text-[12px]">
                <Pill tone="win">{h.tag}</Pill>
                <span className="font-bold">
                  {h.horseNumber != null ? `${h.horseNumber}. ` : ""}
                  {h.nameCh ?? h.nameEn ?? h.horseId}
                </span>
                <span className="text-ink-3">
                  地況三甲 {formatRate(h.goingTop3Rate)} vs 整體 {formatRate(h.overallTop3Rate)}（
                  {formatPp(h.edgePp)} · {h.goingStarts} 仗）
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty
            label={
              !data?.suitedNote || data.suitedNote.includes("meetingId")
                ? "未有合地名單（可揀賽日）"
                : data.suitedNote
            }
          />
        )}
      </Card>

      <p className="mx-4 mt-3 text-[11px] leading-relaxed text-ink-3">
        {GOING_DISCLAIMER} · {GOING_RESEARCH_NOTE}
      </p>
      <Disclaimer />
    </AppShell>
  );
}
