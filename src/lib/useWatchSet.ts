import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { listWatchlist, mutateWatch } from './watchlist.functions';
import { useAuthState } from './useAuthState';
import type { WatchList, WatchRow } from './watchlist';
export function useWatchSet(){const auth=useAuthState();const list=useServerFn(listWatchlist);const mutate=useServerFn(mutateWatch);const client=useQueryClient();const key=['watchlist',auth.userId];
 const query=useQuery({queryKey:key,queryFn:()=>list(),enabled:auth.signedIn===true && !!auth.userId,staleTime:60000});
 const mutation=useMutation({mutationFn:(data:{action:'add'|'remove'|'active';horseId:string;horseName?:string;active?:boolean;swapOutHorseId?:string})=>mutate({data}),onMutate:async(data)=>{await client.cancelQueries({queryKey:key});const old=client.getQueryData<WatchList>(key);if(old){let rows=old.rows;if(data.action==='remove')rows=rows.filter(r=>r.horse_id!==data.horseId);if(data.action==='add' && !rows.some(r=>r.horse_id===data.horseId)){const time=new Date().toISOString();rows=[{horse_id:data.horseId,horse_name:data.horseName ?? data.horseId,user_id:'',paused:false,activated_at:time,created_at:time,notify_entry:true,notify_trial:true,notify_trackwork:true,notify_injury:true,notify_push:true,notify_telegram:true} as WatchRow,...rows];}client.setQueryData(key,{...old,rows,activeCount:rows.filter(r=>!r.paused).length,pausedCount:rows.filter(r=>r.paused).length});}return {old};},onError:(_e,_v,c)=>{if(c?.old)client.setQueryData(key,c.old);},onSettled:()=>{void client.invalidateQueries({queryKey:key});}});
 return {...query,signedIn:auth.signedIn,userId:auth.userId,watchSet:new Map(query.data?.rows.map(r=>[r.horse_id,r]) ?? []),mutation};}
