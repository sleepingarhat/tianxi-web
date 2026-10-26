import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/tx/AppShell";
import { EChart } from "@/components/tx/EChart";
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
import { getLabH2h, searchLabEntity, type LabSearchItem } from "@/lib/lab-h2h.functions";
import {
  aheadLabel,
  buildEloOption,
  entityLabel,
  parseOptionalDistance,
  venueLabel,
} from "@/lib/lab-h2h-ui";

type H2hType = "horse" | "jockey";

type Search = {
  type?: H2hType;
  a?: string;
  b?: string;
  distance?: string;
  going?: string;
  venue?: string;
};

export const Route = createFileRoute("/lab/h2h")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    type: search["type"] === "jockey" ? "jockey" : search["type"] === "horse" ? "horse" : undefined,
    a: typeof search["a"] === "string" ? search["a"] : undefined,
    b: typeof search["b"] === "string" ? search["b"] : undefined,
    distance: typeof search["distance"] === "string" ? search["distance"] : undefined,
    going: typeof search["going"] === "string" ? search["going"] : undefined,
    venue:
      search["venue"] === "ST" || search["venue"] === "HV" ? (search["venue"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "頭對頭比較 · 研究室 · 天喜 TIANXI" },
      {
        name: "description",
        content: "馬匹／騎師頭對頭：Elo 走勢、條件切片、跑法分佈同直接交手紀錄（Pro）。",
      },
      { property: "og:title", content: "頭對頭比較 · 天喜 TIANXI" },
      { property: "og:description", content: "Pro 研究室頭對頭比較。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <FeaturePageGate min="pro" title="頭對頭">
      <H2hPage />
    </FeaturePageGate>
  ),
});

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
  const search = useQuery({
    queryKey: ["lab-search", type, q],
    queryFn: () => searchLabEntity({ data: { type, q } }),
    enabled: q.trim().length >= 1,
    staleTime: 30_000,
  });

  return (
    <div className="flex-1 min-w-[140px]">
      <label className="mb-1 block text-[11px] font-bold text-ink-2">{label}</label>
      {selected ? (
        <div className="flex items-center gap-2 rounded-md border border-hairline bg-paper-2 px-2 py-1.5">
          <span className="flex-1 truncate text-[13px] font-serif-tc font-bold">
            {entityLabel(selected)}
            {selected.code ? (
              <span className="ml-1 text-[10px] font-sans-tc font-normal text-ink-3">
                {selected.code}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            className="text-[11px] text-gold font-bold"
            onClick={() => {
              onSelect(null);
              setQ("");
            }}
          >
            清除
          </button>
        </div>
      ) : (
        <>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={type === "horse" ? "搜馬名／編號" : "搜騎師名／代號"}
            className="w-full rounded-md border border-hairline bg-paper px-2 py-1.5 text-[13px]"
          />
          {q.trim() ? (
            <ul className="mt-1 max-h-40 overflow-auto rounded-md border border-hairline bg-paper text-[12px]">
              {search.isLoading ? (
                <li className="px-2 py-1.5 text-ink-3">搜緊…</li>
              ) : search.error ? (
                <li className="px-2 py-1.5 text-lose">搜尋失敗</li>
              ) : (search.data?.items.length ?? 0) === 0 ? (
                <li className="px-2 py-1.5 text-ink-3">冇結果</li>
              ) : (
                search.data!.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-paper-2"
                      onClick={() => onSelect(item)}
                    >
                      <span className="font-serif-tc font-bold">{entityLabel(item)}</span>
                      {item.code ? <span className="text-[10px] text-ink-3">{item.code}</span> : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}

function H2hPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const type: H2hType = search.type === "jockey" ? "jockey" : "horse";

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
  const canFetch = !!(aId && bId && aId !== bId);

  const distNum = parseOptionalDistance(distance);

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

  const eloOption = useMemo(() => (q.data ? buildEloOption(q.data) : null), [q.data]);

  useEffect(() => {
    if (!q.data) return;
    const { a, b } = q.data.entities;
    setPickA({ id: a.id, nameCh: a.nameCh, nameEn: a.nameEn, code: a.code, status: a.status });
    setPickB({ id: b.id, nameCh: b.nameCh, nameEn: b.nameEn, code: b.code, status: b.status });
  }, [q.data]);

  function syncUrl(next: {
    type?: H2hType;
    a?: string | undefined;
    b?: string | undefined;
    distance?: string;
    going?: string;
    venue?: string;
  }) {
    void navigate({
      to: "/lab/h2h",
      search: {
        type: next.type ?? type,
        a: next.a,
        b: next.b,
        distance: next.distance || undefined,
        going: next.going || undefined,
        venue: next.venue === "ST" || next.venue === "HV" ? next.venue : undefined,
      },
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

  function swap() {
    const na = pickB;
    const nb = pickA;
    setPickA(na);
    setPickB(nb);
    syncUrl({ a: na?.id, b: nb?.id, distance: distance.trim(), going: going.trim(), venue });
  }

  const nameA = q.data ? entityLabel(q.data.entities.a) : pickA ? entityLabel(pickA) : "A";
  const nameB = q.data ? entityLabel(q.data.entities.b) : pickB ? entityLabel(pickB) : "B";

  return (
    <AppShell page="lab" columns={false} wide ticker="頭對頭 · 研究參考 · 非投注建議">
      <PageHead
        en="Head-to-head"
        title="頭對頭比較"
        desc={
          <>
            <Link to="/lab" className="text-gold font-bold">
              ← 研究室
            </Link>
            <span className="mx-2 text-ink-3">·</span>
            馬／騎師 Elo、條件、跑法同直接交手
          </>
        }
      />

      <Card title="揀對象" en="Select">
        <div className="mb-3 flex gap-2">
          {(["horse", "jockey"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`rounded-full px-3 py-1 text-[12px] font-bold ${
                type === t ? "bg-deep text-deep-fg" : "border border-hairline text-ink-2"
              }`}
              onClick={() => {
                setPickA(null);
                setPickB(null);
                syncUrl({ type: t, a: undefined, b: undefined });
              }}
            >
              {t === "horse" ? "比馬" : "比騎師"}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <EntityPicker
            label="對象 A"
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
          <button
            type="button"
            onClick={swap}
            className="mt-5 self-center rounded-md border border-hairline px-2 py-1 text-[11px] font-bold text-gold"
            aria-label="對調"
          >
            對調 ⇄
          </button>
          <EntityPicker
            label="對象 B"
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

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="text-[11px] text-ink-2">
            途程 (m)
            <input
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-hairline px-2 py-1 text-[13px]"
              placeholder="例如 1200"
            />
          </label>
          <label className="text-[11px] text-ink-2">
            地況
            <input
              value={going}
              onChange={(e) => setGoing(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-hairline px-2 py-1 text-[13px]"
              placeholder="例如 好"
            />
          </label>
          <label className="text-[11px] text-ink-2">
            馬場
            <select
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="mt-0.5 w-full rounded-md border border-hairline px-2 py-1 text-[13px]"
            >
              <option value="">全部</option>
              <option value="ST">沙田</option>
              <option value="HV">跑馬地</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={applyFilters}
              className="w-full rounded-md bg-deep px-3 py-1.5 text-[12px] font-bold text-deep-fg"
            >
              套用條件
            </button>
          </div>
        </div>
      </Card>

      {!canFetch ? (
        <div>
          <Empty label="揀兩個唔同對象開始比較" />
        </div>
      ) : q.isLoading ? (
        <Loading label="讀緊頭對頭資料…" />
      ) : q.error ? (
        <div>
          <ErrorNote error={q.error} />
        </div>
      ) : q.data ? (
        <>
          {q.data.warnings.length > 0 ? (
            <div className="mx-4 mt-3 rounded-md border border-tan/30 bg-paper-2 px-3 py-2 text-[12px] text-ink-2">
              {q.data.warnings.map((w) => (
                <p key={w}>⚠ {w}</p>
              ))}
            </div>
          ) : null}

          <Card
            title="Elo 走勢"
            en="Elo"
           
            action={<Pill tone="ink">◆ 同場標註</Pill>}
          >
            {eloOption && (q.data.elo.a.length > 0 || q.data.elo.b.length > 0) ? (
              <EChart option={eloOption} height={220} ariaLabel={`${nameA} 對 ${nameB} Elo`} />
            ) : (
              <Empty label="暫時未有 Elo 快照" />
            )}
          </Card>

          <Card title="條件對照" en="Conditions">
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
          </Card>

          <Card title="跑法分佈" en="Running style">
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
                    {style.buckets.map((b) => (
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
          </Card>

          <Card title="直接交手" en="Meetings">
            {q.data.meetings.length === 0 ? (
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
      ) : null}

      <p className="mx-4 mt-4 text-[11px] leading-relaxed text-ink-3">
        頭對頭只整理歷史表現同 Elo，唔預測勝負，亦唔構成投注建議。
      </p>
      <Disclaimer />
    </AppShell>
  );
}
