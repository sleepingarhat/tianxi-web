import {tgRetry} from './telegram.server';
export async function removeProMember(uid:string,notify=true){
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const r=await supabaseAdmin.from('telegram_links').select('*').eq('user_id',uid).maybeSingle();if(r.error)throw new Error('Telegram 會籍未能核實');
  if(!r.data?.pro_joined_at || r.data.pro_removed_at)return;
  const chat=process.env['TELEGRAM_PRO_CHAT_ID'];if(!chat)throw new Error('Pro 頻道尚未設定');
  const ban=await tgRetry('banChatMember',{chat_id:chat,user_id:r.data.telegram_user_id,until_date:Math.floor(Date.now()/1000)+60,revoke_messages:false});if(!ban.ok)throw new Error(ban.description ?? '移除未能完成');
  const unban=await tgRetry('unbanChatMember',{chat_id:chat,user_id:r.data.telegram_user_id,only_if_banned:true});if(!unban.ok)throw new Error(unban.description ?? '解除封鎖未能完成');
  const updated=await supabaseAdmin.from('telegram_links').update({pro_removed_at:new Date().toISOString()}).eq('user_id',uid);if(updated.error)throw new Error('移除紀錄未能儲存');
  if(notify)await tgRetry('sendMessage',{chat_id:r.data.chat_id,text:'你嘅天喜 Pro 會籍已到期，已暫時移出 Pro 頻道。續訂後可喺個人頁重新申請加入：https://tianxi.racing/membership'});
}