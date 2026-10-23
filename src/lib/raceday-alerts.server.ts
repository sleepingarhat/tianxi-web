import {raceAlertLines,hkDay} from './notification-rules';
import {jobMembership} from './job-membership.server';
import {tgRetry} from './telegram.server';
import {vapidConfig} from './webpush.server';
import {deliverEventPush,renewNotificationLease} from './notification-delivery.server';
import {racedayAvailability} from './notification-availability.server';
import {shouldRecordRacedaySkip} from './notification-availability';
export async function runRacedayAlerts(){
  if(!await racedayAvailability())return {skipped:'raceday_not_live'};
  const {supabaseAdmin:monitor}=await import('@/integrations/supabase/client.server');
  const skip=async(reason:string)=>{const last=await monitor.from('watch_job_runs').select('error,started_at').eq('kind','raceday').order('id',{ascending:false}).limit(1).maybeSingle();if(!last.error && shouldRecordRacedaySkip(last.data?{error:last.data.error,created_at:last.data.started_at}:null,reason,hkDay(Date.now())))await monitor.from('watch_job_runs').insert({kind:'raceday',error:reason,finished_at:new Date().toISOString()});return {skipped:reason};};
  const lockResponse=await fetch('https://tianxi-backend.tianxi-entertainment.workers.dev/api/analyze/lock-state',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!lockResponse.ok)return skip('unavailable');const lock=await lockResponse.json() as {locked?:boolean;edition?:string;date?:string;venue?:string};if(lock.edition==='unavailable')return skip('unavailable');if(!lock.locked || lock.edition!=='final')return skip('not_final');
  const {fetchTodayPicksUpstream}=await import('./picks.functions');const day=await fetchTodayPicksUpstream() as import('./racing-shapes').DayPicks;
  if(day.date!==lock.date || day.venue!==lock.venue || !raceAlertLines(day,true))return skip('unavailable');
  const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');const owner=crypto.randomUUID();const lease=await db.rpc('acquire_notification_job',{k:'raceday',oid:owner});if(lease.error)throw new Error('lease_unavailable');if(!lease.data)return {skipped:'running'};
  const counts={new_rows:0,tg_sent:0,tg_failed:0,push_sent:0,push_failed:0};
  const renew=()=>renewNotificationLease('raceday',owner);
  const run=await db.from('watch_job_runs').insert({kind:'raceday'}).select('id').single();if(run.error){await db.from('notification_job_leases').delete().eq('key','raceday').eq('owner',owner);throw new Error('run_record_failed');}let error:string|null=null;
  try{
    const prefs=await db.from('notification_prefs').select('*').eq('raceday_enabled',true);if(prefs.error)throw new Error('prefs_unavailable');
    for(const pref of prefs.data){await renew();const info=await jobMembership(pref.user_id);const lines=raceAlertLines(day,info.hasPro);if(!lines)continue;const key=`raceday:${day.date}:${day.venue}:final`;
      const inserted=await db.from('raceday_notifications').upsert({user_id:pref.user_id,event_key:key},{onConflict:'user_id,event_key',ignoreDuplicates:true}).select('id');if(inserted.error)throw new Error('ledger_unavailable');counts.new_rows+=inserted.data.length;
      const row=await db.from('raceday_notifications').select('*').eq('user_id',pref.user_id).eq('event_key',key).single();if(row.error)throw new Error('ledger_unavailable');
      const venue=day.venue==='ST'?'沙田':'跑馬地';const link=await db.from('telegram_links').select('*').eq('user_id',pref.user_id).maybeSingle();if(link.error)throw new Error('link_unavailable');
      if(!row.data.sent_telegram_at && pref.telegram_enabled && link.data && !link.data.dm_blocked){const text=`🏁 ${day.date} ${venue} 賽前預測已凍結（最終版）\n${lines.join('\n')}\n${info.hasPro?'':'第 2 場起只限 Pro 會員 → https://tianxi.racing/membership\n'}完整分析：https://tianxi.racing/cards\n預測只供參考，唔構成投注建議。`;const sent=await tgRetry('sendMessage',{chat_id:link.data.chat_id,text,disable_web_page_preview:true});if(sent.ok){const saved=await db.from('raceday_notifications').update({sent_telegram_at:new Date().toISOString()}).eq('id',row.data.id);if(saved.error)throw new Error('delivery_record_failed');counts.tg_sent++;}else{counts.tg_failed++;if(sent.error_code===403)await db.from('telegram_links').update({dm_blocked:true}).eq('user_id',pref.user_id);}}
      if(!row.data.sent_push_at && pref.push_enabled && vapidConfig()){const subs=await db.from('push_subscriptions').select('*').eq('user_id',pref.user_id);if(subs.error)throw new Error('push_unavailable');let complete=subs.data.length>0;for(const sub of subs.data){if(await deliverEventPush(pref.user_id,key,sub,{title:'🏁 賽前預測已凍結',body:`${venue} ${lines[0]} · 撳入睇分析`,url:'/cards',tag:'raceday-'+hkDay(day.date ?? Date.now())},21600,renew)){counts.push_sent++;}else{counts.push_failed++;complete=false;}}if(complete){const saved=await db.from('raceday_notifications').update({sent_push_at:new Date().toISOString()}).eq('id',row.data.id);if(saved.error)throw new Error('push_record_failed');}}
    }return {ok:counts.tg_failed===0 && counts.push_failed===0,...counts};
  }catch(e){error=e instanceof Error?e.message:'raceday_failed';throw e;}finally{if(run.data)await db.from('watch_job_runs').update({...counts,error,finished_at:new Date().toISOString()}).eq('id',run.data.id);await db.from('notification_job_leases').delete().eq('key','raceday').eq('owner',owner);}
}