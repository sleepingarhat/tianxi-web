import {createFileRoute} from '@tanstack/react-router';
import {authenticateCronRequest} from '@/integrations/supabase/cron-auth';
export const Route=createFileRoute('/api/public/jobs/telegram-pro-sweep')({server:{handlers:{POST:async({request})=>{
  const denied=await authenticateCronRequest(request);if(denied)return denied;
  const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
  const gate=await db.rpc('membership_gate_at');if(gate.error)return Response.json({ok:false},{status:502});if(!gate.data)return Response.json({skipped:'gate_not_open'});
  if(!process.env['TIANXI_RACING_BOT_TOKEN'] || !process.env['TELEGRAM_PRO_CHAT_ID'])return Response.json({skipped:'telegram_not_configured'});
  const {runCryptoNotices}=await import('@/lib/crypto-notices.server');const cryptoNotices=await runCryptoNotices();
  const list=await db.from('telegram_links').select('user_id').not('pro_joined_at','is',null).is('pro_removed_at',null).order('last_checked_at',{nullsFirst:true}).limit(200);if(list.error)return Response.json({ok:false},{status:502});
  const {jobMembership}=await import('@/lib/job-membership.server');const {removeProMember}=await import('@/lib/telegram-pro.server');let removed=0,failed=0;
  for(const row of list.data){try{if(!(await jobMembership(row.user_id)).hasPro){await removeProMember(row.user_id);removed++;}await db.from('telegram_links').update({last_checked_at:new Date().toISOString()}).eq('user_id',row.user_id);}catch{failed++;}await new Promise(r=>setTimeout(r,50));}
  return Response.json({ok:failed===0,checked:list.data.length,removed,failed,cryptoNotices},{status:failed?502:200});
}}}});