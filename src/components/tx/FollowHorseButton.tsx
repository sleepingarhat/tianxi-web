import { useState } from 'react';
import { Link, useLocation } from '@tanstack/react-router';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { TxCta } from '@/components/tx/ui';
import { Dialog,DialogContent,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { useWatchSet } from '@/lib/useWatchSet';
import { HORSE_ID } from '@/lib/watchlist';
export function FollowHorseButton({horseId,horseName,variant='icon'}:{horseId?:string|null;horseName:string;variant?:'icon'|'pill'}){
 const location=useLocation();const [guest,setGuest]=useState(false);const [failure,setFailure]=useState<string|null>(null);const watch=useWatchSet();const followed=!!watch.watchSet.get(horseId ?? '');
 if(!horseId || !HORSE_ID.test(horseId))return null;
 const next=location.pathname+location.searchStr;
 const toggle=async()=>{if(watch.signedIn!==true){localStorage.setItem('tx.pendingFollow',JSON.stringify({horseId,horseName,ts:Date.now()}));setGuest(true);return;}
 try{await watch.mutation.mutateAsync({action:followed?'remove':'add',horseId,horseName});toast.success(`${followed?'已取消追蹤':'已追蹤'} ${horseName}`,{action:{label:'復原',onClick:()=>{void watch.mutation.mutateAsync({action:followed?'add':'remove',horseId,horseName}).catch(e=>setFailure(e.message));}}});}catch(e){setFailure(e instanceof Error?e.message:'暫時未能追蹤');}};
 return <><Button variant="ghost" size={variant==='icon'?'icon':'sm'} title={`${followed?'取消追蹤':'追蹤'}${horseName}`} aria-label={`${followed?'取消追蹤':'追蹤'}${horseName}`} disabled={watch.signedIn===null || watch.mutation.isPending} onClick={e=>{e.preventDefault();e.stopPropagation();void toggle();}} className={`shrink-0 ${followed?'text-gold':'text-ink-3'}`}><Star className={followed?'fill-current':''}/>{variant==='pill'?(followed?'已追蹤':'追蹤愛駒'):null}</Button>
 <Dialog open={guest} onOpenChange={setGuest}><DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] overflow-y-auto rounded-md border-hairline bg-paper text-ink"><DialogTitle>免費登記即可追蹤愛駒</DialogTitle><DialogDescription>追蹤後，{horseName}有排位、試閘、傷患或晨操消息都會喺「我的愛駒」顯示。資料每日同步。</DialogDescription><div className="flex gap-2"><TxCta asChild variant="gold"><Link to="/auth" search={{mode:'signup',next,follow:horseId}}>免費登記</Link></TxCta><TxCta asChild variant="outline"><Link to="/auth" search={{next,follow:horseId}}>登入</Link></TxCta></div></DialogContent></Dialog>
 <Dialog open={!!failure} onOpenChange={()=>setFailure(null)}><DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] overflow-y-auto rounded-md border-hairline bg-paper text-ink"><DialogTitle>暫時未能追蹤</DialogTitle><DialogDescription>{failure?.replace('WATCH_LIMIT: ','')}</DialogDescription><div className="flex flex-wrap gap-2"><TxCta asChild variant="deep"><Link to="/my-horses">管理我的愛駒</Link></TxCta><TxCta asChild variant="outline"><Link to="/membership">查看 Pro 方案</Link></TxCta></div></DialogContent></Dialog></>;
}
