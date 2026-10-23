import { resolveEntitlement, type SubRow } from './entitlement';
export async function jobMembership(userId: string) {
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const result=await supabaseAdmin.rpc('membership_for_notification_job',{uid:userId});
  if(result.error || !result.data)throw new Error('暫時未能核實會籍');
  const row=result.data as unknown as {rank:number|null;total:number;gate_open_at:string|null;threshold:number;founding_slots:number};
  const environment=import.meta.env['VITE_PAYMENTS_CLIENT_TOKEN']?.startsWith('pk_live_')?'live':'sandbox';
  const sub=await supabaseAdmin.from('subscriptions').select('status,current_period_end,cancel_at_period_end').eq('user_id',userId).eq('environment',environment).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(sub.error)throw new Error('暫時未能核實訂閱');
  const pass=await supabaseAdmin.rpc('crypto_pass_until',{uid:userId,env:environment});if(pass.error)throw new Error('暫時未能核實通行證');
  const entitlement=resolveEntitlement({rank:row.rank,total:row.total,gateOpenAt:row.gate_open_at,threshold:row.threshold,foundingSlots:row.founding_slots,subscription:sub.data as SubRow|null,cryptoPassUntil:pass.data});
  return {hasPro:entitlement.hasPro,gateOpen:!!row.gate_open_at};
}