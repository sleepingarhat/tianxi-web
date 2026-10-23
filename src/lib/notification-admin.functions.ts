import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {z} from 'zod';
export const telegramAdmin=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({setWebhook:z.boolean().default(false)}).parse(d ?? {})).handler(async({context,data})=>{
  const role=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(role.error || !role.data)throw new Error('只限管理員');
  const {tg,telegramConfigured}=await import('./telegram.server');if(!telegramConfigured())return {configured:false,host:null,pending:0,lastError:'會員 Bot 憑證尚未提供',members:null};
  if(data.setWebhook){const r=await tg('setWebhook',{url:'https://tianxi.racing/api/public/telegram/webhook',secret_token:process.env['TELEGRAM_WEBHOOK_SECRET'],allowed_updates:['message','my_chat_member','chat_join_request'],drop_pending_updates:false});if(!r.ok)throw new Error(r.description ?? '設定未能完成');}
  const [info,count]=await Promise.all([tg<{url:string;pending_update_count:number;last_error_message?:string}>('getWebhookInfo',{}),tg<number>('getChatMemberCount',{chat_id:process.env['TELEGRAM_PRO_CHAT_ID']})]);
  return {configured:true,host:info.result?.url ? new URL(info.result.url).host:null,pending:info.result?.pending_update_count ?? 0,lastError:info.result?.last_error_message ?? info.description ?? null,members:count.result ?? null};
});
export const notificationRuns=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const role=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(role.error || !role.data)throw new Error('只限管理員');
  const r=await context.supabase.from('watch_job_runs').select('*').order('started_at',{ascending:false}).limit(20);if(r.error)throw new Error('通知紀錄未能讀取');return r.data;
});
export const watchFreshness=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async()=>{
  const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
  const r=await db.from('watch_job_runs').select('feed_freshness,finished_at').eq('kind','watch').not('feed_freshness','is',null).order('started_at',{ascending:false}).limit(1).maybeSingle();
  if(r.error)throw new Error('同步時間未能讀取');return r.data?.feed_freshness ?? null;
});