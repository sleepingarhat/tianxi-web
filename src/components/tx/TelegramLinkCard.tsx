import {useState} from 'react';
import {Link} from '@tanstack/react-router';
import {useServerFn} from '@tanstack/react-start';
import {useQuery} from '@tanstack/react-query';
import {toast} from 'sonner';
import {createTelegramLinkToken,getTelegramLink,unlinkTelegram,requestProChannelInvite} from '@/lib/telegram.functions';
import {useAuthState} from '@/lib/useAuthState';
import {useTier} from '@/lib/useTier';
import {Card} from './ui';
import {Button} from '@/components/ui/button';
export function TelegramLinkCard(){const auth=useAuthState();const tier=useTier();const [until,setUntil]=useState(0);const [busy,setBusy]=useState(false);const get=useServerFn(getTelegramLink);const create=useServerFn(createTelegramLinkToken);const unlink=useServerFn(unlinkTelegram);const invite=useServerFn(requestProChannelInvite);const q=useQuery({queryKey:['telegram-link',auth.userId],enabled:auth.signedIn===true,queryFn:()=>get(),refetchInterval:()=>until>Date.now()?3000:false});
  const act=async(fn:()=>Promise<{url?:string}|unknown>)=>{setBusy(true);try{const r=await fn();if(r && typeof r==='object' && 'url' in r && typeof r.url==='string')window.open(r.url,'_blank','noopener,noreferrer');await q.refetch();}catch(e){toast.error(e instanceof Error?e.message:'Telegram 暫未能完成');}finally{setBusy(false);}};
  return <Card title="Telegram" en="@tianxi_racing_bot">{q.error?<p className="text-xs text-ink-3">連結暫未能讀取 <Button variant="ghost" size="sm" onClick={()=>void q.refetch()}>再試</Button></p>:q.isPending?<p className="text-xs text-ink-3">讀取中…</p>:!q.data?.configured?<p className="text-sm text-ink-2">會員 Telegram 通知尚未啟用。</p>:<>{q.data.linked?<><p className="text-sm">已連結 {q.data.username?`@${q.data.username}`:'Telegram 帳戶'}</p><Button size="sm" variant="outline" className="mt-3" disabled={busy} onClick={()=>void act(unlink)}>解除連結</Button>{q.data.dmBlocked?<p className="mt-3 text-xs text-lose">你已封鎖 bot，請喺 Telegram 解除封鎖先收到通知。</p>:null}</>:<><Button disabled={busy} onClick={()=>void act(async()=>{const r=await create();setUntil(Date.now()+120000);return r;})}>連結 Telegram</Button><p className="mt-2 text-xs text-ink-3">會開啟 @tianxi_racing_bot，撳「開始」即完成連結。</p></>}<div className="mt-4 border-t border-hairline pt-3">{tier.has('pro')?<><Button variant="outline" size="sm" disabled={busy || !q.data.linked} onClick={()=>void act(invite)}>加入 Pro 頻道</Button><p className="mt-2 text-xs text-ink-3">連結 1 小時內有效，只限你已連結嘅 Telegram 帳戶。</p></>:<p className="text-xs">Pro 頻道只限 Pro 會員 · <Link to="/membership" className="text-gold">查看會籍</Link></p>}</div></>}</Card>;
}