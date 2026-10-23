import {buildPushPayload} from '@block65/webcrypto-web-push';
import {pushDisposition,validPushEndpoint} from './push-rules';
import type {Database} from '@/integrations/supabase/types';
export type PushRow=Database['public']['Tables']['push_subscriptions']['Row'];
export function vapidConfig(){const publicKey=process.env['VAPID_PUBLIC_KEY'];const privateKey=process.env['VAPID_PRIVATE_KEY'];const subject=process.env['VAPID_SUBJECT'];return publicKey && privateKey && subject?{publicKey,privateKey,subject}:null;}
export async function deliverPush(row:PushRow,message:{title:string;body:string;url:string;tag:string},ttl=21600){
  const vapid=vapidConfig();if(!vapid)return false;const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');let status=0;
  try{if(!validPushEndpoint(row.endpoint))status=410;else{const payload=await buildPushPayload({data:JSON.stringify(message),options:{ttl}},{endpoint:row.endpoint,expirationTime:null,keys:{p256dh:row.p256dh,auth:row.auth}},vapid);status=(await fetch(row.endpoint,{...payload,signal:AbortSignal.timeout(8000)})).status;}}catch{status=0;}
  const disposition=pushDisposition(status,row.fail_count);
  const saved=disposition==='delete'?await db.from('push_subscriptions').delete().eq('id',row.id):await db.from('push_subscriptions').update(disposition==='success'?{last_success_at:new Date().toISOString(),fail_count:0}:{fail_count:row.fail_count+1}).eq('id',row.id);
  return !saved.error && disposition==='success';
}