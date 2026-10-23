import {createServerFn} from '@tanstack/react-start';
import {requireTier} from './tier.server';
export const getTelegramLink=createServerFn({method:'POST'}).middleware([requireTier('registered')]).handler(async({context})=>{
  const {telegramConfigured}=await import('./telegram.server');
  const r=await context.supabase.from('telegram_links').select('telegram_username,dm_blocked,pro_joined_at,pro_removed_at').eq('user_id',context.userId).maybeSingle();
  if(r.error)throw new Error('Telegram 連結未能讀取');
  return {configured:telegramConfigured(),linked:!!r.data,username:r.data?.telegram_username,dmBlocked:r.data?.dm_blocked ?? false,proJoined:!!r.data?.pro_joined_at && !r.data?.pro_removed_at};
});
export const createTelegramLinkToken=createServerFn({method:'POST'}).middleware([requireTier('registered')]).handler(async({context})=>{
  const {telegramConfigured}=await import('./telegram.server');if(!telegramConfigured())throw new Error('會員 Telegram Bot 尚未設定');
  const {randomBytes,createHash}=await import('node:crypto');const token=randomBytes(24).toString('base64url');
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const r=await supabaseAdmin.rpc('create_telegram_link_token',{uid:context.userId,hash:createHash('sha256').update(token).digest('hex')});
  if(r.error)throw new Error('每小時最多建立 5 次連結，請稍後再試');
  return {url:`https://t.me/tianxi_racing_bot?start=${token}`};
});
export const unlinkTelegram=createServerFn({method:'POST'}).middleware([requireTier('registered')]).handler(async({context})=>{
  const {removeProMember}=await import('./telegram-pro.server');await removeProMember(context.userId,false);
  const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
  const r=await db.from('telegram_links').delete().eq('user_id',context.userId);if(r.error)throw new Error('解除連結未能完成');return {ok:true};
});
export const requestProChannelInvite=createServerFn({method:'POST'}).middleware([requireTier('registered')]).handler(async({context})=>{
  const {jobMembership}=await import('./job-membership.server');if(!(await jobMembership(context.userId)).hasPro)throw new Error('Pro 頻道只限 Pro 會員');
  const r=await context.supabase.from('telegram_links').select('chat_id').eq('user_id',context.userId).maybeSingle();if(r.error || !r.data)throw new Error('請先連結 Telegram');
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const reservation=await supabaseAdmin.rpc('reserve_telegram_invite',{uid:context.userId});if(reservation.error)throw new Error('每日最多申請 3 次，請稍後再試');
  const {tg}=await import('./telegram.server');const chat=process.env['TELEGRAM_PRO_CHAT_ID'];if(!chat)throw new Error('Pro 頻道尚未設定');
  const response=await tg<{invite_link:string}>('createChatInviteLink',{chat_id:chat,creates_join_request:true,expire_date:Math.floor(Date.now()/1000)+3600,name:'u-'+context.userId.slice(0,8)});
  if(!response.ok || !response.result)throw new Error(response.description ?? '邀請未能建立');
  const saved=await supabaseAdmin.from('telegram_pro_invites').update({invite_link:response.result.invite_link}).eq('id',Number(reservation.data));
  if(saved.error){await tg('revokeChatInviteLink',{chat_id:chat,invite_link:response.result.invite_link});throw new Error('邀請未能儲存');}
  await tg('sendMessage',{chat_id:r.data.chat_id,text:'加入天喜 Pro 頻道（1 小時內有效）：'+response.result.invite_link});return {url:response.result.invite_link};
});