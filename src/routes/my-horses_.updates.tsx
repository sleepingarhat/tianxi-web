import { createFileRoute,Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { AppShell } from '@/components/tx/AppShell';
import { PageHead,Card,Pill,TxCta } from '@/components/tx/ui';
import { useWatchSet } from '@/lib/useWatchSet';
import { getHorseFeed } from '@/lib/watchlist.functions';
import type { FeedType } from '@/lib/watch-events';
export const Route=createFileRoute('/my-horses_/updates')({head:()=>({meta:[{title:'愛駒動態 · 天喜賽馬'},{name:'description',content:'一頁睇晒你追蹤馬匹近30日嘅排位、晨操、試閘同傷患紀錄，資料來自香港賽馬會公佈。'},{property:'og:title',content:'愛駒動態 · 天喜賽馬'},{property:'og:description',content:'追蹤馬匹最新排位、晨操、試閘及傷患。'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}]}),component:HorseUpdates});
const TYPES:{key:FeedType;label:string}[]=[{key:'entry',label:'排位'},{key:'trackwork',label:'晨操'},{key:'trial',label:'試閘'},{key:'injury',label:'傷患'}];
function HorseUpdates(){
 const watch=useWatchSet();const feedFn=useServerFn(getHorseFeed);
 const rows=watch.data?.rows ?? [];const ids=rows.map(r=>r.horse_id);
 const feed=useQuery({queryKey:['watch-feed',watch.userId,ids],queryFn:()=>feedFn({data:{horseIds:ids}}),enabled:watch.signedIn===true && ids.length>0,staleTime:300000,retry:2});
 return <AppShell><PageHead en="Horse updates" title="愛駒動態" desc="近 30 日排位、晨操、試閘及傷患 · 馬會官方公佈 · 約每 30 分鐘同步"/>
 <div className="mx-4 mb-4"><Link to="/my-horses" className="text-xs text-gold">← 返回我的愛駒</Link></div>
 {watch.signedIn===null?<p className="mx-4 text-sm text-ink-3">讀取登入狀態中…</p>:null}
 {watch.signedIn===false?<section className="mx-4 mb-6"><p className="mb-3 text-sm text-ink-2">登入後可睇你追蹤馬匹嘅動態。</p><TxCta asChild variant="gold"><Link to="/auth" search={{next:'/my-horses/updates'}}>登入</Link></TxCta></section>:null}
 {watch.signedIn && !ids.length && !watch.isPending?<p className="mx-4 text-sm text-ink-3">未追蹤任何馬匹，可以去<Link to="/my-horses" className="text-gold">我的愛駒</Link>加入。</p>:null}
 {feed.isError?<p className="mx-4 mb-3 text-xs text-destructive">動態來源暫時讀取唔到，稍後再試；唔代表馬匹冇動態。</p>:null}
 <section className="grid gap-0 md:grid-cols-2">{rows.map(row=>{const f=feed.data?.feed?.[row.horse_id];return <Card key={row.horse_id} title={row.horse_name ?? row.horse_id} en={row.horse_id.replace('horse_','')} action={<Link to="/horse" search={{id:row.horse_id}} className="text-xs text-gold">檔案 →</Link>}>
  {row.paused?<Pill>已暫停提示</Pill>:null}
  <dl className="grid gap-2 text-xs">{TYPES.map(t=>{const items=f?.[t.key] ?? [];return <div key={t.key} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2 border-b border-hairline pb-2 last:border-0"><dt className="font-bold text-ink-2">{t.label}</dt><dd className="min-w-0">{feed.isPending?<span className="text-ink-3">讀取中…</span>:!items.length?<span className="text-ink-3">近 30 日未有紀錄</span>:<ul className="grid gap-1">{items.slice(0,t.key==='trackwork'?3:2).map((e,i)=><li key={i} className="break-words"><span className="tabular-nums text-ink-3">{e.date}</span> {e.title}{e.detail?<span className="text-ink-3"> · {e.detail}</span>:null}</li>)}</ul>}</dd></div>;})}</dl>
 </Card>;})}</section>
 <p className="mx-4 my-6 text-xs text-ink-3">資料以香港賽馬會公佈為準；只屬參考，唔影響天喜選馬或凍結紀錄。</p>
 </AppShell>;
}
