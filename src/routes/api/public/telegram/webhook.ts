import {createFileRoute} from '@tanstack/react-router';
import {validTelegramSecret,tg} from '@/lib/telegram.server';
import {jobMembership} from '@/lib/job-membership.server';
type Update={message?:{text?:string;chat:{id:number;type?:string};from?:{id:number;username?:string}};my_chat_member?:{chat:{id:number;type?:string};from:{id:number};new_chat_member:{status:string;user:{id:number}}};chat_join_request?:{chat:{id:number};from:{id:number}}};
export const Route=createFileRoute('/api/public/telegram/webhook')({server:{handlers:{POST:async({request})=>{
  if(!validTelegramSecret(request.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? ''))return new Response('Unauthorized',{status:401});
  try{
    const u=await request.json() as Update;const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
    const m=u.message;
    if(m?.chat.type==='private' && m.from && m.chat.id===m.from.id){
      const match=/^\/start(?:@tianxi_racing_bot)?\s+([A-Za-z0-9_-]{32})$/.exec(m.text ?? '');
      if(match?.[1]){
        const {createHash}=await import('node:crypto');const hash=createHash('sha256').update(match[1]).digest('hex');
        const token=await db.from('telegram_link_tokens').select('user_id').eq('token_hash',hash).is('used_at',null).gt('expires_at',new Date().toISOString()).maybeSingle();
        if(token.data){
          const old=await db.from('telegram_links').select('user_id').eq('telegram_user_id',m.from.id).maybeSingle();
          const {removeProMember}=await import('@/lib/telegram-pro.server');
          if(old.data && old.data.user_id!==token.data.user_id)await removeProMember(old.data.user_id,false);
          await removeProMember(token.data.user_id,false);
        }
        const linked=await db.rpc('consume_telegram_link_token',{hash,tid:m.from.id,tname:m.from.username ?? '',cid:m.chat.id});
        await tg('sendMessage',{chat_id:m.chat.id,text:linked.data===true && !linked.error?'✅ 已成功連結天喜賽馬帳戶。之後愛駒動態同收賽日提示會喺呢度通知你。傳 /stop 可暫停通知。':'連結已失效，請返去 tianxi.racing 個人頁重新撳「連結 Telegram」。'});
      }else if(/^\/start/.test(m.text ?? ''))await tg('sendMessage',{chat_id:m.chat.id,text:'請先喺 tianxi.racing 登入，再喺個人頁撳「連結 Telegram」。'});
      else if(['/stop','/resume'].includes(m.text ?? '')){
        const link=await db.from('telegram_links').select('user_id').eq('telegram_user_id',m.from.id).maybeSingle();
        if(link.data){const saved=await db.from('notification_prefs').upsert({user_id:link.data.user_id,telegram_enabled:m.text==='/resume'});if(saved.error)throw new Error('prefs');await tg('sendMessage',{chat_id:m.chat.id,text:m.text==='/stop'?'已暫停 Telegram 通知。傳 /resume 恢復。':'已恢復 Telegram 通知。'});}
      }
    }
    const member=u.my_chat_member;if(member?.chat.type==='private')await db.from('telegram_links').update({dm_blocked:member.new_chat_member.status==='kicked'}).eq('chat_id',member.chat.id);
    const join=u.chat_join_request;
    if(join && String(join.chat.id)===process.env['TELEGRAM_PRO_CHAT_ID']){
      const link=await db.from('telegram_links').select('user_id,chat_id').eq('telegram_user_id',join.from.id).maybeSingle();
      const eligible=!link.error && link.data && (await jobMembership(link.data.user_id)).hasPro;
      const response=await tg(eligible?'approveChatJoinRequest':'declineChatJoinRequest',{chat_id:join.chat.id,user_id:join.from.id});
      if(!response.ok)throw new Error('join_request_failed');
      if(eligible && link.data){const saved=await db.from('telegram_links').update({pro_joined_at:new Date().toISOString(),pro_removed_at:null}).eq('user_id',link.data.user_id);if(saved.error)throw new Error('join_record_failed');}
      else if(link.data)await tg('sendMessage',{chat_id:link.data.chat_id,text:'未能加入 Pro 頻道：請先喺 tianxi.racing 連結 Telegram 並確認會籍。'});
    }
  }catch{console.error('telegram-webhook handling failed');return Response.json({ok:false},{status:503});}
  return Response.json({ok:true});
}}}});