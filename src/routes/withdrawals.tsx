import { createFileRoute, Link } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { AppShell } from '@/components/tx/AppShell';
import { Card, PageHead, Pill, Stat, ErrorNote } from '@/components/tx/ui';
import { getWithdrawalTracker } from '@/lib/withdrawal-tracker.functions';
import { withdrawalTimingLabel } from '@/lib/withdrawal-substitution';
const options=(date:string)=>queryOptions({queryKey:['withdrawal-tracker',date],queryFn:()=>getWithdrawalTracker({data:{date}}),retry:false,staleTime:30_000});
export const Route=createFileRoute('/withdrawals')({
  validateSearch:z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).catch('2026-10-21')}),
  loaderDeps:({search})=>({date:search.date}),
  loader:({context,deps})=>context.queryClient.ensureQueryData(options(deps.date)),
  head:()=>({meta:[{title:'退出馬追蹤 · 天喜 TIANXI'},{name:'description',content:'官方退出原因、公布時間、原凍結四揀及訓練驗收狀態逐項核對。'},{property:'og:title',content:'退出馬追蹤 · 天喜 TIANXI'},{property:'og:description',content:'官方原文指紋、凍結證據及鎖後換騎分組，缺證據不補造。'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),
  errorComponent:({error})=><AppShell><PageHead en="WITHDRAWAL EVIDENCE" title="退出馬追蹤"/><div className="p-4"><ErrorNote error={error}/></div></AppShell>,
  component:WithdrawalPage,
});
function WithdrawalPage(){
  const {date}=Route.useSearch(); const {data}=useSuspenseQuery(options(date));
  const labels:Record<string,string>={available:'已核實原副本','no-archive':'未有原始凍結副本','not-verified':'副本未核實','verification-failed':'副本核對未通過'};
  const group=data.summary?.groups['post-lock-jockey-change'];
  return <AppShell columns={false}>
    <PageHead en="WITHDRAWAL EVIDENCE" title="退出馬追蹤"/>
    <div className="flex flex-wrap gap-4 border-b border-hairline p-4 text-sm">
      {['2026-10-21','2026-10-19','2026-10-14'].map(d=><Link key={d} to="/withdrawals" search={{date:d}} aria-current={date===d?'page':undefined} className={date===d?'font-bold text-gold underline':'text-ink-2'}>{d}</Link>)}
      <Link to="/race-changes" className="text-gold underline">官方更改</Link>
    </div>
    <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
      <Stat label="賽日" value={date}/><Stat label="退出／被替換" value={data.withdrawals.length}/>
      <Stat label="四揀平均中" value={data.summary?.originalAverage?.toFixed(2) ?? '待核'} sub={data.summary?`${data.summary.races} 場入分母`:'未有可核實戰績'}/>
      <Stat label="鎖後換騎組" value={group?.originalAverage?.toFixed(2) ?? '待核'} sub={`${group?.races ?? 0} 場已核實`}/>
    </div>
    <section className="grid gap-4 border-y border-hairline bg-paper-2 p-4 text-xs lg:grid-cols-2">
      <div className="space-y-2"><Pill tone={data.frozenEvidence==='available'?'win':'gold'}>{labels[data.frozenEvidence] ?? '未核實'}</Pill><p className="text-ink-2">鎖點：{data.lockAt ?? '未核實'}</p><p className="break-all font-mono-tx text-ink-3">凍結 SHA：{data.frozenSha ?? '無原副本，不能事後補造'}</p></div>
      <div className="space-y-2"><p className="text-ink-2">官方擷取：{data.fetchedAt ?? '未有存檔'}</p><p className="break-all font-mono-tx text-ink-3">原文 SHA：{data.sha256 ?? '未有存檔'}</p>{data.source?<a className="break-all text-gold underline" href={data.source} target="_blank" rel="noreferrer">馬會官方更易事項</a>:null}</div>
    </section>
    <div className="grid gap-1 lg:grid-cols-2">
      {data.withdrawals.map(c=><Card key={`${c.raceNumber}:${c.horseNumber}:${c.horseName}`} title={`第${c.raceNumber}場 · ${c.horseNumber}號 ${c.horseName}`} action={<Pill tone="lose">{c.kind==='replaced'?'退出／後備補上':'退出'}</Pill>}>
        <dl className="grid grid-cols-[84px_minmax(0,1fr)] gap-2 text-xs leading-relaxed">
          <dt className="text-ink-3">官方公布</dt><dd>{c.announcedAtIso ?? c.announcedAt}</dd>
          <dt className="text-ink-3">退出原因</dt><dd>{c.text}</dd>
          <dt className="text-ink-3">鎖點分類</dt><dd>{withdrawalTimingLabel(c.beforeLock,c.originalRank,c.metricEligible)}</dd>
          <dt className="text-ink-3">原選排名</dt><dd>{c.originalRank ?? '未有匹配原副本'}</dd>
          <dt className="text-ink-3">本場原四揀</dt><dd>{c.metricEligible?`中 ${c.originalHits}／4`:'未核實／不入分母'}</dd>
          <dt className="text-ink-3">訓練資料</dt><dd className="text-gold">待驗收：未有逐匹訓練產物及來源指紋證據</dd>
        </dl>
      </Card>)}
    </div>
    {!data.withdrawals.length?<p className="p-4 text-sm text-ink-2">{data.sha256?'此存檔沒有退出事項':'未有官方退出存檔；不代表沒有退出'}</p>:null}
  </AppShell>;
}