import {createServerFn} from '@tanstack/react-start';
import {requireTier} from './tier.server';
import {z} from 'zod';
import {validPushEndpoint} from './push-rules';
export const getVapidPublicKey=createServerFn({method:'POST'}).middleware([requireTier('registered')]).handler(async()=>{
  const {vapidConfig}=await import('./webpush.server');return {publicKey:vapidConfig()?.publicKey ?? null};
});
export const ownsPushSubscription=createServerFn({method:'POST'}).middleware([requireTier('registered')]).inputValidator((d:unknown)=>z.object({endpoint:z.string().max(3000).refine(validPushEndpoint)}).parse(d)).handler(async({data,context})=>{const r=await context.supabase.from('push_subscriptions').select('id').eq('user_id',context.userId).eq('endpoint',data.endpoint).maybeSingle();if(r.error)throw new Error('推送狀態未能核實');return {owned:!!r.data};});
const endpoint=z.string().max(3000).refine(validPushEndpoint,'推送地址不受支援');
export const savePushSubscription=createServerFn({method:'POST'}).middleware([requireTier('registered')]).inputValidator((d:unknown)=>z.object({endpoint,keys:z.object({p256dh:z.string().regex(/^[A-Za-z0-9_-]{87,88}$/),auth:z.string().regex(/^[A-Za-z0-9_-]{22,24}$/)}),userAgent:z.string().max(500)}).parse(d)).handler(async({data,context})=>{
  const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');const r=await db.rpc('save_push_subscription',{uid:context.userId,ep:data.endpoint,pkey:data.keys.p256dh,akey:data.keys.auth,agent:data.userAgent});if(r.error)throw new Error('此裝置未能儲存；如曾登入另一帳戶，請先關閉該帳戶推送');return {ok:true};
});
export const deletePushSubscription=createServerFn({method:'POST'}).middleware([requireTier('registered')]).inputValidator((d:unknown)=>z.object({endpoint}).parse(d)).handler(async({data,context})=>{const r=await context.supabase.from('push_subscriptions').delete().eq('user_id',context.userId).eq('endpoint',data.endpoint);if(r.error)throw new Error('未能關閉推送');return {ok:true};});
export const sendTestPush=createServerFn({method:'POST'}).middleware([requireTier('registered')]).handler(async({context})=>{
  const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');const {vapidConfig,deliverPush}=await import('./webpush.server');if(!vapidConfig())throw new Error('推送通知尚未設定');
  const reserved=await db.rpc('reserve_push_test',{uid:context.userId});if(reserved.error)throw new Error('每小時最多發送 5 次測試');const r=await context.supabase.from('push_subscriptions').select('*').eq('user_id',context.userId);if(r.error || !r.data.length)throw new Error('此帳戶未有推送裝置');
  const results=await Promise.all(r.data.map(row=>deliverPush(row,{title:'測試通知',body:'推送已啟用 ✅',url:'/my-horses',tag:'test'})));return {sent:results.filter(Boolean).length,failed:results.filter(r=>!r).length};
});