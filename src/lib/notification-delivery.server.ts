import type {PushRow} from './webpush.server';
import {deliverPush} from './webpush.server';
import {undeliveredWatchRows,watchPushDigest} from './watch-digest';
/** Record each accepted activity per device even when the next retry has a different batch. */
export async function deliverWatchDigest(uid:string,rows:{id:string|number;event_key:string;title:string;event_type:string;created_at:string}[],sub:PushRow,renew:()=>Promise<void>){
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
 const receipts=await db.from('push_delivery_receipts').select('event_key').eq('user_id',uid).eq('subscription_id',sub.id).in('event_key',rows.map(r=>r.event_key));
 if(receipts.error)throw new Error('push_receipt_unavailable');
 const pending=undeliveredWatchRows(rows,receipts.data);const digest=watchPushDigest(pending);if(!digest)return true;
 await renew();if(!await deliverPush(sub,digest.message,digest.ttl))return false;
 const saved=await db.from('push_delivery_receipts').upsert(pending.map(r=>({user_id:uid,event_key:r.event_key,subscription_id:sub.id})),{onConflict:'user_id,event_key,subscription_id'});
 if(saved.error)throw new Error('push_receipt_write_failed');return true;
}
export async function renewNotificationLease(key:string,owner:string){
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
 const result=await db.rpc('renew_notification_job',{k:key,oid:owner});
 if(result.error || !result.data)throw new Error('notification_lease_lost');
}
/** A provider receipt belongs to one event and one device, never to all devices. */
export async function deliverEventPush(uid:string,eventKey:string,sub:PushRow,message:Parameters<typeof deliverPush>[1],ttl:number,renew:()=>Promise<void>){
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
 const receipt=await db.from('push_delivery_receipts').select('delivered_at').eq('user_id',uid).eq('event_key',eventKey).eq('subscription_id',sub.id).maybeSingle();
 if(receipt.error)throw new Error('push_receipt_unavailable');
 if(receipt.data)return true;
 await renew();
 if(!await deliverPush(sub,message,ttl))return false;
 const saved=await db.from('push_delivery_receipts').upsert({user_id:uid,event_key:eventKey,subscription_id:sub.id},{onConflict:'user_id,event_key,subscription_id'});
 if(saved.error)throw new Error('push_receipt_write_failed');
 return true;
}