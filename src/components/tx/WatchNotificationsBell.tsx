import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Bell } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useAuthState } from '@/lib/useAuthState';
import { listNotifications } from '@/lib/watchlist.functions';
export function WatchNotificationsBell(){const auth=useAuthState();const fn=useServerFn(listNotifications);const q=useQuery({queryKey:['watch-notifications',auth.userId],enabled:!!auth.userId,queryFn:()=>fn({data:{limit:50}}),staleTime:60000});const unread=q.data?.filter(r=>!r.read_at).length ?? 0;return <details className="relative"><summary aria-label={`愛駒動態，${unread}項未讀`} className="relative grid h-8 w-8 cursor-pointer list-none place-items-center"><Bell size={18}/>{unread>0?<span className="absolute -right-1 -top-1 text-[10px] text-gold-strong">{unread}</span>:null}</summary><div className="absolute right-0 top-10 z-50 w-60 rounded-md border border-hairline bg-paper p-3 text-ink shadow-sm">{q.data?.slice(0,5).map(r=><p key={r.id} className="border-b border-hairline py-2 text-xs">{r.title}</p>)}{!q.data?.length?<p className="text-xs text-ink-3">暫時未有動態</p>:null}<Link to="/my-horses" className="mt-2 block text-xs font-bold text-gold">查看全部</Link></div></details>;}
