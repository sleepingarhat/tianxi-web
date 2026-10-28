import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { AppShell } from "@/components/tx/AppShell";
import { EChart } from "@/components/tx/EChart";
import { FeaturePageGate } from "@/components/tx/gates/FeaturePageGate";
import { Card, Disclaimer, Empty, ErrorNote, Loading, PageHead, Pill } from "@/components/tx/ui";
import { OptionListPicker } from "@/components/tx/OptionListPicker";
import { validateEntityId, type LabEntityType } from "@/lib/lab-entity-id";
import { getLabH2h, searchLabEntity, type LabSearchItem } from "@/lib/lab-h2h.functions";
import {
  H2H_DISTANCE_OPTIONS,
  H2H_GOING_OPTIONS,
  H2H_PRODUCT_LABEL,
  aheadLabel,
  buildEloOption,
  eloEmptyLabel,
  entityLabel,
  fillPickFromEntities,
  filterEntities,
  parseOptionalDistance,
  resolveTrainerCatalog,
  selectableEntities,
  venueLabel,
  withCurrentChoice,
} from "@/lib/lab-h2h-ui";
import type { ListOption } from "@/lib/option-list";
import { txApi } from "@/lib/tx-api";

type H2hType = LabEntityType;

type Search = {
  type?: H2hType;
  a?: string;
  b?: string;
  distance?: string;
  going?: string;
  venue?: string;
};

const TYPE_BUTTONS: { type: H2hType; label: string }[] = [
  { type: "horse", label: "比馬" },
  { type: "jockey", label: "比騎師" },
  { type: "trainer", label: "比練馬師" },
];

export const Route = createFileRoute("/lab/h2h")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const out: Search = {};
    if (search["type"] === "jockey" || search["type"] === "trainer" || search["type"] === "horse") {
      out.type = search["type"];
    }
    if (typeof search["a"] === "string") out.a = search["a"];
    if (typeof search["b"] === "string") out.b = search["b"];
    if (typeof search["distance"] === "string") out.distance = search["distance"];
    if (typeof search["going"] === "string") out.going = search["going"];
    if (search["venue"] === "ST" || search["venue"] === "HV") out.venue = search["venue"];
    return out;
  },
  head: () => ({
    meta: [
      { title: `${H2H_PRODUCT_LABEL} · 功能 · 天喜 TIANXI` },
      {
        name: "description",
        content:
          "分開比較兩匹馬、兩位騎師或兩位練馬師：Elo 走勢、條件切片、跑法分佈同直接交手紀錄（Pro）。",
      },
      { property: "og:title", content: `${H2H_PRODUCT_LABEL} · 天喜 TIANXI` },
      { property: "og:description", content: `Pro 功能：${H2H_PRODUCT_LABEL}。` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <FeaturePageGate min="pro" title={H2H_PRODUCT_LABEL}>
      <H2hPage />
    </FeaturePageGate>
  ),
});

function toSearchItem(raw: {
  id?: string;
  nameCh?: string | null;
  nameEn?: string | null;
  code?: string | null;
  status?: string | null;
}): LabSearchItem | null {
  if (!raw.id) return null;
  return {
    id: raw.id,
    nameCh: raw.nameCh ?? null,
    nameEn: raw.nameEn ?? null,
    code: raw.code ?? null,
    status: raw.status ?? null,
  };
}

function mapPeople(rows: Array<Record<string, unknown>> | undefined): LabSearchItem[] {
  return (rows ?? [])
    .map((row) =>
      toSearchItem({
        id: typeof row["id"] === "string" ? row["id"] : "",
        nameCh: typeof row["nameCh"] === "string" ? row["nameCh"] : null,
        nameEn: typeof row["nameEn"] === "string" ? row["nameEn"] : null,
        code: typeof row["code"] === "string" ? row["code"] : null,
        status: typeof row["status"] === "string" ? row["status"] : null,
      }),
    )
    .filter((row): row is LabSearchItem => !!row);
}

function sideNoun(type: H2hType): string {
  if (type === "horse") return "馬匹";
  if (type === "jockey") return "騎師";
  return "練馬師";
}

function searchPlaceholder(type: H2hType, selected: LabSearchItem | null): string {
  if (selected) return entityLabel(selected);
  if (type === "horse") return "搜馬名或編號";
  if (type === "jockey") return "搜騎師名";
  return "搜練馬師名";
}

function EntityPicker({
  label,
  type,
  selected,
  onSelect,
}: {
  label: string;
  type: H2hType;
  selected: LabSearchItem | null;
  onSelect: (item: LabSearchItem | null) => void;
}) {
  const [q, setQ] = useState("");
  const jockeys = useQuery({
    queryKey: ["lab-jockey-list"],
    queryFn: () => txApi.jockeys() as Promise<{ jockeys?: Array<Record<string, unknown>> }>,
    enabled: type === "jockey",
    staleTime: 5 * 60_000,
  });
  const horses = useQuery({
    queryKey: ["lab-horse-search", q.trim()],
    queryFn: () =>
      txApi.horseSearch(q.trim()) as Promise<{ horses?: Array<Record<string, unknown>> }>,
    enabled: type === "horse" && q.trim().length >= 1,
    staleTime: 30_000,
  });
  const trainers = useQuery({
    queryKey: ["lab-trainer-list"],
    queryFn: () => txApi.trainers() as Promise<{ trainers?: Array<Record<string, unknown>> }>,
    enabled: type === "trainer",
    staleTime: 5 * 60_000,
  });
  const trainerSearch = useQuery({
    queryKey: ["lab-trainer-search", q.trim()],
    queryFn: () => searchLabEntity({ data: { type: "trainer", q: q.trim() } }),
    enabled: type === "trainer" && q.trim().length >= 1,
    retry: false,
    staleTime: 30_000,
  });

  const trainerResolved = useMemo(() => {
    if (type !== "trainer") return null;
    return resolveTrainerCatalog({
      query: q,
      searchItems: trainerSearch.isSuccess ? (trainerSearch.data?.items ?? []) : null,
      publicItems: mapPeople(trainers.data?.trainers),
    });
  }, [type, q, trainerSearch.isSuccess, trainerSearch.data, trainers.data]);

  const catalog = useMemo(() => {
    if (type === "jockey") return selectableEntities("jockey", mapPeople(jockeys.data?.jockeys));
    if (type === "trainer") return trainerResolved?.items ?? [];
    return selectableEntities("horse", mapPeople(horses.data?.horses));
  }, [type, jockeys.data, horses.data, trainerResolved]);

  const listed = trainerResolved?.fromSearch ? catalog : filterEntities(catalog, q);
  const options: ListOption[] = listed.map((item) => {
    const opt: ListOption = { id: item.id, label: entityLabel(item) };
    if (item.code) opt.hint = item.code;
    return opt;
  });
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const listError =
    type === "horse"
      ? horses.isError
      : type === "jockey"
        ? jockeys.isError
        : trainers.isError &&
          !(trainerSearch.isSuccess && (trainerSearch.data?.items?.length ?? 0) > 0);

  return (
    <div className="min-w-0">
      <OptionListPicker
        label={label}
        query={q}
        onQueryChange={setQ}
        placeholder={searchPlaceholder(type, selected)}
        options={options}
        selectedId={selected?.id ?? ""}
        onSelect={(id) => {
          const item = byId.get(id) ?? listed.find((row) => row.id === id);
          if (!item || !validateEntityId(type, item.id)) return;
          onSelect(item);
        }}
        loading={
          type === "jockey"
            ? jockeys.isLoading
            : type === "trainer"
              ? trainers.isLoading && !trainerSearch.isSuccess
              : horses.isLoading
        }
        emptyLabel={
          type === "horse" && q.trim().length < 1
            ? "輸入馬名或編號，喺清單揀"
            : listError
              ? "清單暫時讀唔到"
              : "冇符合項目"
        }
      />
      {selected ? (
        <button
          type="button"
          className="mt-1 text-[11px] font-bold text-gold"
          onClick={() => onSelect(null)}
        >
          清除已揀：{entityLabel(selected)}
        </button>
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0 text-[11px] font-bold text-ink-2">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-hairline bg-paper px-2 py-2 text-[13px] font-normal text-ink"
      >
        {children}
      </select>
    </label>
  );
}

function H2hPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const type: H2hType = search.type ?? "horse";

  const [pickA, setPickA] = useState<LabSearchItem | null>(
    search.a ? { id: search.a, nameCh: null, nameEn: null, code: null, status: null } : null,
  );
  const [pickB, setPickB] = useState<LabSearchItem | null>(
    search.b ? { id: search.b, nameCh: null, nameEn: null, code: null, status: null } : null,
  );
  const [distance, setDistance] = useState(search.distance ?? "");
  const [going, setGoing] = useState(search.going ?? "");
  const [venue, setVenue] = useState(search.venue ?? "");

  const aId = pickA?.id ?? search.a;
  const bId = pickB?.id ?? search.b;
  const canFetch = !!(
    aId &&
    bId &&
    aId !== bId &&
    validateEntityId(type, aId) &&
    validateEntityId(type, bId)
  );

  const distNum = parseOptionalDistance(distance);
  const distanceChoices = useMemo(
    () => withCurrentChoice(H2H_DISTANCE_OPTIONS, distance),
    [distance],
  );
  const goingChoices = useMemo(() => withCurrentChoice(H2H_GOING_OPTIONS, going), [going]);

  const q = useQuery({
    queryKey: ["lab-h2h", type, aId, bId, distNum ?? "", going, venue],
    queryFn: () =>
      getLabH2h({
        data: {
          type,
          a: aId!,
          b: bId!,
          ...(distNum != null ? { distance: distNum } : {}),
          ...(going.trim() ? { going: going.trim() } : {}),
          ...(venue === "ST" || venue === "HV" ? { venue: venue as "ST" | "HV" } : {}),
        },
      }),
    enabled: canFetch,
    staleTime: 60_000,
  });

  const eloOption = useMemo(() => {
    if (!q.data?.entities?.a || !q.data.entities.b) return null;
    return buildEloOption(q.data);
  }, [q.data]);

  // 只按 id 補名，唔覆寫用戶揀嘅 A/B 次序；回應次序唔同都唔會再觸發互換循環。
  useEffect(() => {
    const entities = q.data?.entities;
    if (!entities?.a || !entities.b) return;
    setPickA((prev) => fillPickFromEntities(prev, entities));
    setPickB((prev) => fillPickFromEntities(prev, entities));
  }, [q.data]);

  function syncUrl(next: {
    type?: H2hType;
    a?: string | undefined;
    b?: string | undefined;
    distance?: string | undefined;
    going?: string | undefined;
    venue?: string | undefined;
  }) {
    const search: Search = { type: next.type ?? type };
    if (next.a) search.a = next.a;
    if (next.b) search.b = next.b;
    if (next.distance) search.distance = next.distance;
    if (next.going) search.going = next.going;
    if (next.venue === "ST" || next.venue === "HV") search.venue = next.venue;
    void navigate({
      to: "/lab/h2h",
      search,
      replace: true,
    });
  }

  function applyFilters() {
    syncUrl({
      a: aId,
      b: bId,
      distance: distance.trim(),
      going: going.trim(),
      venue,
    });
  }

  const nameA = q.data?.entities?.a
    ? entityLabel(q.data.entities.a)
    : pickA
      ? entityLabel(pickA)
      : "A";
  const nameB = q.data?.entities?.b
    ? entityLabel(q.data.entities.b)
    : pickB
      ? entityLabel(pickB)
      : "B";
  const noun = sideNoun(type);

  return (
    <AppShell
      page="lab"
      columns={false}
      wide
      ticker={`${H2H_PRODUCT_LABEL} · 研究參考 · 非投注建議`}
    >
      <PageHead
        en="Independent comparison"
        title={H2H_PRODUCT_LABEL}
        desc={
          <>
            <Link to="/lab" className="text-gold font-bold">
              ← 功能
            </Link>
            <span className="mx-2 text-ink-3">·</span>
            分開比較兩匹馬、兩位騎師或兩位練馬師嘅 Elo、條件、跑法同直接交手
          </>
        }
      />

      <Card title="揀對象" en="Select">
        <div className="mb-3 flex flex-wrap gap-2">
          {TYPE_BUTTONS.map((item) => (
            <button
              key={item.type}
              type="button"
              className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${
                type === item.type ? "bg-deep text-deep-fg" : "border border-hairline text-ink-2"
              }`}
              onClick={() => {
                setPickA(null);
                setPickB(null);
                syncUrl({ type: item.type, a: undefined, b: undefined });
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <EntityPicker
            label={`${noun} A`}
            type={type}
            selected={pickA}
            onSelect={(item) => {
              setPickA(item);
              syncUrl({
                a: item?.id,
                b: bId,
                distance: distance.trim(),
                going: going.trim(),
                venue,
              });
            }}
          />
          <EntityPicker
            label={`${noun} B`}
            type={type}
            selected={pickB}
            onSelect={(item) => {
              setPickB(item);
              syncUrl({
                a: aId,
                b: item?.id,
                distance: distance.trim(),
                going: going.trim(),
                venue,
              });
            }}
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
          <FilterSelect label="途程 (m)" value={distance} onChange={setDistance}>
            {distanceChoices.map((option) => (
              <option key={option.id || "all"} value={option.id}>
                {option.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="地況" value={going} onChange={setGoing}>
            {goingChoices.map((option) => (
              <option key={option.id || "all"} value={option.id}>
                {option.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="馬場" value={venue} onChange={setVenue}>
            <option value="">全部</option>
            <option value="ST">沙田</option>
            <option value="HV">跑馬地</option>
          </FilterSelect>
          <button
            type="button"
            onClick={applyFilters}
            className="w-full rounded-md bg-deep px-3 py-2 text-[13px] font-bold text-deep-fg"
          >
            套用條件
          </button>
        </div>
      </Card>

      {!canFetch ? (
        <div>
          <Empty label="揀兩個唔同對象開始比較" />
        </div>
      ) : q.isLoading ? (
        <Loading label="讀緊比較資料…" />
      ) : q.error ? (
        <div>
          <ErrorNote error={q.error} />
        </div>
      ) : q.data?.entities?.a && q.data.entities.b ? (
        <>
          {(q.data.warnings ?? []).length > 0 ? (
            <div className="mx-4 mt-3 rounded-md border border-tan/30 bg-paper-2 px-3 py-2 text-[12px] text-ink-2">
              {q.data.warnings.map((w) => (
                <p key={w}>⚠ {w}</p>
              ))}
            </div>
          ) : null}

          <Card title="Elo 走勢" en="Elo" action={<Pill tone="ink">◆ 同場標註</Pill>}>
            {eloOption && ((q.data.elo?.a?.length ?? 0) > 0 || (q.data.elo?.b?.length ?? 0) > 0) ? (
              <EChart option={eloOption} height={220} ariaLabel={`${nameA} 對 ${nameB} Elo`} />
            ) : (
              <Empty label={eloEmptyLabel(type)} />
            )}
          </Card>

          <Card title="條件對照" en="Conditions">
            {(q.data.conditions ?? []).length === 0 ? (
              <Empty label="暫時未有條件對照" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-hairline text-ink-3">
                      <th className="py-1.5 pr-2 font-bold">條件</th>
                      <th className="py-1.5 pr-2 font-bold">{nameA}</th>
                      <th className="py-1.5 font-bold">{nameB}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.conditions.map((row) => (
                      <tr key={row.key} className="border-b border-hairline/60 align-top">
                        <td className="py-1.5 pr-2 font-serif-tc font-bold">{row.label}</td>
                        <td className="py-1.5 pr-2 text-ink-2">
                          {row.a.starts === 0
                            ? "—"
                            : `${row.a.starts} 出 · ${row.a.wins} 勝 · ${row.a.top3} 三甲 · 均名 ${row.a.avgPlace ?? "—"}`}
                          {row.a.lowSample && row.a.starts > 0 ? (
                            <span className="ml-1 text-[10px] text-ink-3">（樣本少）</span>
                          ) : null}
                        </td>
                        <td className="py-1.5 text-ink-2">
                          {row.b.starts === 0
                            ? "—"
                            : `${row.b.starts} 出 · ${row.b.wins} 勝 · ${row.b.top3} 三甲 · 均名 ${row.b.avgPlace ?? "—"}`}
                          {row.b.lowSample && row.b.starts > 0 ? (
                            <span className="ml-1 text-[10px] text-ink-3">（樣本少）</span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="跑法分佈" en="Running style">
            {q.data.runningStyle?.a && q.data.runningStyle.b ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["A", nameA, q.data.runningStyle.a],
                    ["B", nameB, q.data.runningStyle.b],
                  ] as const
                ).map(([key, name, style]) => (
                  <div key={key} className="rounded-md border border-hairline p-2">
                    <p className="mb-1 font-serif-tc text-[13px] font-bold">
                      {name}
                      {style.lowSample ? (
                        <span className="ml-2 text-[10px] font-sans-tc font-normal text-ink-3">
                          樣本較少
                        </span>
                      ) : null}
                    </p>
                    <p className="mb-1 text-[10px] text-ink-3">樣本 {style.sample} 場</p>
                    <ul className="space-y-0.5 text-[12px]">
                      {(style.buckets ?? []).map((b) => (
                        <li key={b.code} className="flex justify-between gap-2">
                          <span>
                            {b.label}（{b.code}）
                          </span>
                          <span className="text-ink-2">
                            {b.count} · {b.share}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <Empty label="暫時未有跑法分佈" />
            )}
          </Card>

          <Card title="直接交手" en="Meetings">
            {(q.data.meetings ?? []).length === 0 ? (
              <Empty label="篩選條件下未有同場紀錄" />
            ) : (
              <ul className="divide-y divide-hairline text-[12px]">
                {q.data.meetings.map((m) => (
                  <li key={m.raceId} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
                    <span className="font-bold text-ink">{m.date}</span>
                    <span className="text-ink-3">
                      {venueLabel(m.venue)}
                      {m.raceNumber != null ? ` · 第${m.raceNumber}場` : ""}
                      {m.distance != null ? ` · ${m.distance}m` : ""}
                      {m.going ? ` · ${m.going}` : ""}
                    </span>
                    <span className="text-ink-2">
                      {nameA} 第{m.a.position ?? "—"}（檔{m.a.draw ?? "—"}）／{nameB} 第
                      {m.b.position ?? "—"}（檔{m.b.draw ?? "—"}）
                    </span>
                    <Pill tone={m.ahead === "tie" ? "ink" : "gold"}>
                      {aheadLabel(m.ahead, nameA, nameB)}
                    </Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : q.data ? (
        <div>
          <ErrorNote error={new Error("比較資料唔完整，請稍後再試")} />
        </div>
      ) : null}

      <p className="mx-4 mt-4 text-[11px] leading-relaxed text-ink-3">
        {H2H_PRODUCT_LABEL}只整理歷史表現同 Elo，唔預測勝負，亦唔構成投注建議。練馬師未必有 Elo
        走勢。
      </p>
      <Disclaimer />
    </AppShell>
  );
}
