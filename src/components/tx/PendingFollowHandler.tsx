import { useLocation } from '@tanstack/react-router';
import { useEffect,useRef } from 'react';
import { toast } from 'sonner';
import { useWatchSet } from '@/lib/useWatchSet';
import { readPendingFollow } from '@/lib/watchlist';
export function PendingFollowHandler(){const location=useLocation();const watch=useWatchSet();const running=useRef(false);
 useEffect(()=>{if(watch.signedIn!==true || running.current)return;const params=new URLSearchParams(window.location.search);const pending=readPendingFollow(localStorage.getItem('tx.pendingFollow'));if(window.location.pathname==='/auth')return;if(!pending){localStorage.removeItem('tx.pendingFollow');return;}running.current=true;
 void watch.mutation.mutateAsync({action:'add',horseId:pending.horseId,horseName:pending.horseName}).then(()=>toast.success(`已追蹤 ${pending.horseName} ⭐`)).catch(e=>toast.error(e instanceof Error?e.message:'未能追蹤，可到我的愛駒重試')).finally(()=>{localStorage.removeItem('tx.pendingFollow');params.delete('follow');window.history.replaceState(window.history.state,'',window.location.pathname+(params.size?'?'+params.toString():'')+window.location.hash);});
 },[watch.signedIn,location.pathname]);return null;}
