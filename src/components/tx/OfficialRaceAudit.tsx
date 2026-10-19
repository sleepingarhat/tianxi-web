import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, Pill } from './ui';
import { summarizeOfficialMetrics, type OfficialMetricInput } from '@/lib/racing-official-metrics';

type AuditRace = { raceNumber: number; effectiveTop4: { original: number[]; effective: number[]; status: string; substituted: boolean }; metricInput: OfficialMetricInput; officialMetric: { eligible: boolean; originalHits: number | null; alternativeHits: number | null }; changeClassification: { hasWithdrawal: boolean; postLockJockeyChange: boolean } };
type AuditDay = { snapshot: { sha256: string }; races: AuditRace[]; officialChanges: { source: string } | null };
export function OfficialRaceAudit({ accounting = false }: { accounting?: boolean }) {
  const [date, setDate] = useState('');
  const query = useQuery({ queryKey: ['original-race-audit', date], enabled: !!date, queryFn: async (): Promise<AuditDay> => {
    const response = await fetch(`/api/public/frozen-racing?date=${encodeURIComponent(date)}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? '原凍結暫時未能核實');
    return body;
  } });
  const day = query.data;
  const summary = day ? summarizeOfficialMetrics(day.races.map(r=>r.metricInput)) : null;
  return <Card title={accounting ? '原注與補位逐場核對' : '原四揀正式命中 · 逐場核對'} en="Original Frozen Selections">
    <label className="flex flex-wrap items-center gap-2 text-[12px] text-ink">賽日
      <input aria-label="原四揀核對賽日" type="date" value={date} onChange={e=>setDate(e.target.value)} className="min-w-0 rounded-[6px] border border-hairline bg-paper px-2 py-1 text-ink" />
    </label>
    {query.isFetching ? <p className="mt-3 text-[12px] text-ink-3">核對原凍結中…</p> : query.error ? <p role="alert" className="mt-3 text-[12px] text-lose">{query.error.message}</p> : null}
    {summary ? <p className="my-3 text-[12px] text-ink-2">正式原四揀平均 {summary.originalAverage?.toFixed(2) ?? '—'}／4 · {summary.races} 場 · 無效／待核 {summary.excluded} 場</p> : null}
    {day?.races.map(r=><article key={r.raceNumber} className="border-b border-hairline py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2 text-[12px]"><b className="text-ink">第 {r.raceNumber} 場</b>
        {r.effectiveTop4.status==='invalid-prelock-input' ? <Pill tone="lose">鎖前輸入無效 · 不計分</Pill> : r.metricInput.status==='unverified-changes-read' ? <Pill tone="lose">馬會更改未能核實 · 不計分</Pill> : r.effectiveTop4.status!=='valid' ? <Pill tone="gold">更改時間待核</Pill> : r.changeClassification.hasWithdrawal ? <Pill tone="gold">鎖後退出</Pill> : null}
        {r.changeClassification.postLockJockeyChange ? <Pill tone="gold">鎖後換騎</Pill> : null}
      </div>
      <p className="mt-2 font-mono-tx text-[12px] text-ink-2">原四揀 {r.effectiveTop4.original.join('–')} · 正式命中 {r.officialMetric.originalHits ?? '—'}／4</p>
      {r.effectiveTop4.substituted ? <p className="mt-1 font-mono-tx text-[12px] text-gold">補位備選 {r.effectiveTop4.effective.join('–')} · 備選命中 {r.officialMetric.alternativeHits ?? '—'}／4（不入正式戰績／盈虧）</p> : null}
      {accounting ? <p className="mt-2 text-[11px] text-ink-3">原注成本／官方退款／派彩：待結算讀回核實；補位不當重新下注，不併入總盈虧。</p> : null}
    </article>)}
    {day ? <div className="mt-3 text-[10px] text-ink-3"><p className="break-all">原凍結 SHA-256：{day.snapshot.sha256}</p>{day.officialChanges ? <a href={day.officialChanges.source} target="_blank" rel="noreferrer" className="mt-1 inline-block text-gold underline">馬會官方更易事項</a> : null}</div> : null}
  </Card>;
}