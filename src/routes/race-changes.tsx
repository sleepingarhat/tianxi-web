import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/tx/AppShell";
import { Card, Disclaimer, Empty, ErrorNote, Loading, PageHead, Pill } from "@/components/tx/ui";
import { useHkjcChanges, useChangeProgress } from "@/lib/use-hkjc-changes";
import { progressForChange, progressLabel, verifiedUpdate } from '@/lib/racing-change-progress';
import { useTodayPicks } from "@/lib/use-today-picks";

export const Route = createFileRoute("/race-changes")({
  head: () => ({
    meta: [
      { title: "賽事更改及重算通知 · 天喜 TIANXI" },
      { name: "description", content: "香港賽馬會官方更易事項：退出、後備補上、換騎及磅重更改，附官方公布時間及存檔指紋。" },
      { property: "og:title", content: "賽事更改及重算通知 · 天喜 TIANXI" },
      { property: "og:description", content: "馬會官方更改內容、公布時間、排位更新及已核對重算時間。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RaceChangesPage,
});

const hkNow = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
const hkTime = (iso: string | null | undefined) => iso && Number.isFinite(Date.parse(iso)) ? new Date(Date.parse(iso) + 8 * 3600_000).toISOString().replace("T", " ").slice(0, 19) : '—';

function RaceChangesPage() {
  const tp = useTodayPicks();
  const date = tp.date || hkNow();
  const q = useHkjcChanges(date);
  const progress = useChangeProgress(date);

  const affected = new Map<string, any>();
  for (const r of (tp.races ?? []) as import('@/lib/racing-shapes').RaceRow[]) for (const p of r.picks || []) if (p.officialChange) affected.set(`${r.raceNumber}:${p.horseNumber}`, { rank: p.rank });

  const snap = q.data;
  const changes = snap?.changes ?? [];
  const byRace = new Map<number, typeof changes>();
  for (const c of changes) byRace.set(c.raceNumber, [...(byRace.get(c.raceNumber) ?? []), c]);

  return (
    <AppShell>
      <PageHead en="OFFICIAL CHANGES" title="賽事更改及重算通知" desc="官方公告 · 排位更新 · 重算狀態；鎖後原紀錄維持不變。" />
      <div className="mx-auto max-w-3xl space-y-3 p-4 lg:max-w-none">
        <Link to="/withdrawals" search={{date}} className="inline-block text-sm text-gold underline">退出馬追蹤與存證</Link>
        {progress.error ? <ErrorNote error={progress.error} /> : null}
        {q.isLoading ? <Loading /> : q.error ? <ErrorNote error={q.error} /> : !snap ? (
          <Empty label={`${date} 未有已存檔嘅官方更改紀錄`} />
        ) : (
          <>
            <Card title="官方來源" en="SOURCE">
              <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-2 gap-y-1 text-[11px]">
                <dt className="text-ink-3">賽日</dt><dd className="font-mono-tx text-ink">{snap.race_date} · {snap.venue === "ST" ? "沙田" : "跑馬地"}</dd>
                <dt className="text-ink-3">擷取時間</dt><dd className="font-mono-tx text-ink">{hkTime(snap.fetched_at)} HKT</dd>
                <dt className="text-ink-3">原文指紋</dt><dd className="break-all font-mono-tx text-[10px] text-ink-2">{snap.sha256}</dd>
                <dt className="text-ink-3">來源</dt><dd><a href={snap.source_url} target="_blank" rel="noreferrer" className="break-all text-gold underline">{snap.source_url}</a></dd>
              </dl>
            </Card>
            <Card title={`更易事項（${changes.length} 項）`} en="CHANGES">
              {changes.length ? (
                <ul className="divide-y divide-hairline">
                  {[...byRace.entries()].sort((a, b) => a[0] - b[0]).map(([race, list]) => (
                    <li key={race} className="py-2">
                      <p className="mb-1 font-serif-tc text-[12px] font-bold text-ink">第 {race} 場</p>
                      {list.map((c, i) => {
                        const hit = affected.get(`${c.raceNumber}:${c.horseNumber}`);
                        const update = progressForChange(c, progress.data ?? []);
                        return (
                          <div key={i} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-2 py-1 text-[11px]">
                            <span className="tabnum grid h-6 w-6 place-items-center rounded-[4px] border border-gold-strong/45 bg-paper-2 font-mono-tx text-[10px] font-bold text-ink">{c.horseNumber}</span>
                            <div className="min-w-0">
                              <p className="text-ink"><b>{c.horseName}</b> {c.text}</p>
                              <p className="mt-1 text-ink-2">{progressLabel(update)}</p>
                              <dl className="mt-1 grid grid-cols-[72px_minmax(0,1fr)] gap-1 text-ink-3">
                                <dt>更新開始</dt><dd className="font-mono-tx">{hkTime(update?.requested_at)} HKT</dd>
                                <dt>重算核對</dt><dd className="font-mono-tx">{verifiedUpdate(update) ? hkTime(update?.recomputed_at) : '—'} HKT</dd>
                                <dt>預測生成</dt><dd className="font-mono-tx">{verifiedUpdate(update) ? hkTime(update?.generated_at) : '—'} HKT</dd>
                              </dl>
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                <Pill tone={c.kind === "other" ? "ink" : "lose"}>{c.kind === "replaced" ? "退出・後備補上" : c.kind === "scratched" ? "退出" : "其他更改"}</Pill>
                                {hit ? <Link to="/predictor"><Pill tone="gold">影響天喜凍結第 {hit.rank} 選</Pill></Link> : null}
                              </div>
                            </div>
                            <span className="tabnum shrink-0 font-mono-tx text-[10px] text-ink-3">{c.announcedAt}</span>
                          </div>
                        );
                      })}
                    </li>
                  ))}
                </ul>
              ) : <Empty label="今日暫無官方更改" />}
            </Card>
          </>
        )}
        <Disclaimer extra="時間為馬會公布時間（香港時間，日/月 時:分），並非網站收料時間。以官方原文指紋核對；本頁唔會改寫任何凍結預測或戰績。" />
      </div>
    </AppShell>
  );
}
