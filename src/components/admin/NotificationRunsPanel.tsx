import {useServerFn} from '@tanstack/react-start';
import {useQuery} from '@tanstack/react-query';
import {notificationRuns} from '@/lib/notification-admin.functions';
import {Panel} from './kit';
import {hkDateTime} from '@/lib/hkTime';
export function NotificationRunsPanel(){const fn=useServerFn(notificationRuns);const q=useQuery({queryKey:['admin','notification-runs'],queryFn:()=>fn(),refetchInterval:60000});return <Panel title="愛駒提示 Job" en="Notification runs" className="mt-4"><div className="divide-y divide-hairline">{q.data?.map(r=><div key={r.id} className="py-2 text-xs"><p>{hkDateTime(r.started_at)} · {r.kind==='raceday'?'收賽日':'愛駒'} · {r.new_rows} 項新動態</p><p className="mt-1 break-words text-ink-3">Telegram {r.tg_sent} 成功／{r.tg_failed} 失敗 · 推送 {r.push_sent} 成功／{r.push_failed} 失敗{r.error?` · ${r.error}`:''}</p></div>)}</div>{!q.data?.length?<p className="text-xs text-ink-3">{q.error?'紀錄暫未能讀取':'暫未有執行紀錄'}</p>:null}</Panel>;}