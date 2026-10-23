import {tgRetry} from './telegram.server';
import {vapidConfig} from './webpush.server';
import {deliverEventPush,renewNotificationLease} from './notification-delivery.server';
export async function runCryptoNotices(passId?:string){
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');const owner=crypto.randomUUID();const lease=await db.rpc('acquire_notification_job',{k:'crypto-notices',oid:owner});if(lease.error)throw new Error('lease_unavailable');if(!lease.data)return {skipped:'running'};
 const renew=()=>renewNotificationLease('crypto-notices',owner);let sent=0,failed=0;
 try{
 let query=db.from('crypto_passes').select('*').eq('status','finished').order('created_at');if(passId)query=query.eq('id',passId);const passes=await query;if(passes.error)throw new Error('passes_unavailable');
 const environment=process.env['NOWPAYMENTS_SANDBOX']==='1'?'sandbox':'live';
 for(const pass of passes.data){if(pass.environment!==environment || !pass.valid_until)continue;await renew();const date=new Date(pass.valid_until).toLocaleDateString('zh-HK',{timeZone:'Asia/Hong_Kong'});const messages=[{key:`crypto-active:${pass.id}`,title:'Pro 已啟用',body:`✅ 已收到加密貨幣付款，Pro 有效至 ${date}。`}];if(new Date(pass.valid_until)>new Date() && new Date(pass.valid_until).getTime()-Date.now()<=14*86400000)messages.push({key:`crypto-expiry:${pass.id}`,title:'Pro 通行證即將到期',body:`你嘅 Pro 通行證將於 ${date} 到期。`});
 const [prefs,link,subs]=await Promise.all([db.from('notification_prefs').select('*').eq('user_id',pass.user_id).maybeSingle(),db.from('telegram_links').select('*').eq('user_id',pass.user_id).maybeSingle(),db.from('push_subscriptions').select('*').eq('user_id',pass.user_id)]);if(prefs.error || link.error || subs.error)throw new Error('channels_unavailable');
 for(const message of messages){const inserted=await db.from('raceday_notifications').upsert({user_id:pass.user_id,event_key:message.key},{onConflict:'user_id,event_key',ignoreDuplicates:true});if(inserted.error)throw new Error('ledger_unavailable');const ledger=await db.from('raceday_notifications').select('*').eq('user_id',pass.user_id).eq('event_key',message.key).single();if(ledger.error)throw new Error('ledger_unavailable');
 if(!ledger.data.sent_telegram_at && link.data && !link.data.dm_blocked && prefs.data?.telegram_enabled){await renew();const r=await tgRetry('sendMessage',{chat_id:link.data.chat_id,text:message.body});if(r.ok){const saved=await db.from('raceday_notifications').update({sent_telegram_at:new Date().toISOString()}).eq('id',ledger.data.id);if(saved.error)throw new Error('receipt_failed');sent++;}else{failed++;if(r.error_code===403)await db.from('telegram_links').update({dm_blocked:true}).eq('user_id',pass.user_id);}}
 if(!ledger.data.sent_push_at && prefs.data?.push_enabled && vapidConfig()){let complete=subs.data.length>0;for(const sub of subs.data){if(await deliverEventPush(pass.user_id,message.key,sub,{title:message.title,body:message.body,url:'/membership',tag:message.key},21600,renew))sent++;else{complete=false;failed++;}}if(complete){const saved=await db.from('raceday_notifications').update({sent_push_at:new Date().toISOString()}).eq('id',ledger.data.id);if(saved.error)throw new Error('receipt_failed');}}
 }
 }return {sent,failed};
 }finally{await db.from('notification_job_leases').delete().eq('key','crypto-notices').eq('owner',owner);}
}