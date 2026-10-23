import type {PushRow} from './webpush.server';
import {deliverPush} from './webpush.server';
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