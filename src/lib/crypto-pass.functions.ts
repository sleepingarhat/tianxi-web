import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {requireTier} from './tier.server';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {cryptoSettingsSchema} from './crypto-pass';

export const getCryptoOffer=createServerFn({method:'POST'}).middleware([requireTier('registered')]).handler(async({context})=>{
 const [settings,m]=await Promise.all([context.supabase.from('app_settings').select('key,value').in('key',['crypto_pass_enabled','crypto_pass_price_usd','crypto_pass_weeks']),context.supabase.rpc('my_membership')]);
 if(settings.error || m.error)throw new Error('暫時未能讀取通行證設定');
 const values=Object.fromEntries((settings.data ?? []).map(r=>[r.key,r.value]));
 const parsed=cryptoSettingsSchema.parse({crypto_pass_enabled:values['crypto_pass_enabled'] ?? false,crypto_pass_price_usd:values['crypto_pass_price_usd'] ?? 416,crypto_pass_weeks:values['crypto_pass_weeks'] ?? 52});
 return {...parsed,gateOpen:!!(m.data as {gate_open_at?:string|null})?.gate_open_at};
});
export const listMyCryptoPasses=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const r=await context.supabase.from('crypto_passes').select('id,status,price_usd,weeks,created_at,valid_from,valid_until,environment').eq('user_id',context.userId).order('created_at',{ascending:false}).limit(100);if(r.error)throw new Error('暫時未能讀取付款紀錄');return r.data;
});
export const createCryptoCheckout=createServerFn({method:'POST'}).middleware([requireTier('registered')]).inputValidator((d:unknown)=>z.object({confirm:z.boolean().default(false)}).parse(d)).handler(async({data,context})=>{
 const settings=await context.supabase.from('app_settings').select('key,value').in('key',['crypto_pass_enabled','crypto_pass_price_usd','crypto_pass_weeks']);const m=await context.supabase.rpc('my_membership');if(settings.error || m.error)throw new Error('暫時未能核實收費設定');
 const values=Object.fromEntries((settings.data ?? []).map(r=>[r.key,r.value]));if(!values['crypto_pass_enabled'] || !(m.data as {gate_open_at?:string|null})?.gate_open_at)return {error:'收費閘未開放，現時所有註冊會員已免費享 Pro。'};
 const config=cryptoSettingsSchema.parse({...values,crypto_pass_weeks:values['crypto_pass_weeks'] ?? 52});
 const env=process.env['NOWPAYMENTS_SANDBOX']==='1'?'sandbox':'live';const stripeEnv=import.meta.env['VITE_PAYMENTS_CLIENT_TOKEN']?.startsWith('pk_live_')?'live':'sandbox';
 const sub=await context.supabase.from('subscriptions').select('status,current_period_end').eq('user_id',context.userId).eq('environment',stripeEnv).order('created_at',{ascending:false}).limit(1).maybeSingle();if(sub.error)throw new Error('暫時未能核實訂閱');
 if(sub.data?.status==='active' && (!sub.data.current_period_end || new Date(sub.data.current_period_end)>new Date()) && !data.confirm)return {warning:'你已有每週訂閱，請先喺 Stripe 管理頁取消，以免重複收費。'};
 const apiKey=process.env['NOWPAYMENTS_API_KEY'];if(!apiKey || !process.env['NOWPAYMENTS_IPN_SECRET'])return {error:'加密貨幣收款尚未完成設定，暫不開賣。'};
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');const reservation=await db.rpc('reserve_crypto_checkout',{uid:context.userId,env,amount:config.crypto_pass_price_usd,duration:config.crypto_pass_weeks});if(reservation.error || !reservation.data)return {error:'今日付款連結已達上限，或收費尚未開放。'};
 try{const base=env==='sandbox'?'https://api-sandbox.nowpayments.io':'https://api.nowpayments.io';const response=await fetch(base+'/v1/invoice',{method:'POST',headers:{'content-type':'application/json','x-api-key':apiKey},body:JSON.stringify({price_amount:config.crypto_pass_price_usd,price_currency:'usd',order_id:reservation.data,order_description:`天喜賽馬 Pro ${config.crypto_pass_weeks} 週通行證`,ipn_callback_url:'https://tianxi.racing/api/public/payments/crypto-ipn',success_url:'https://tianxi.racing/membership?crypto=success',cancel_url:'https://tianxi.racing/membership?crypto=cancel',is_fixed_rate:true,is_fee_paid_by_user:false}),signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`收款服務暫未能建立付款連結（${response.status}）`);const invoice=z.object({id:z.union([z.string(),z.number()]).transform(String),invoice_url:z.string().url().refine(v=>{const u=new URL(v);return u.protocol==='https:' && (u.hostname==='nowpayments.io' || u.hostname.endsWith('.nowpayments.io'));})}).parse(await response.json());const saved=await db.from('crypto_passes').update({invoice_id:invoice.id}).eq('id',reservation.data);if(saved.error)throw new Error('付款連結未能保存');return {url:invoice.invoice_url};}catch(e){await db.from('crypto_passes').update({status:'failed'}).eq('id',reservation.data);return {error:e instanceof Error?e.message:'付款連結未能建立'};}
});
export const getAdminCrypto=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const role=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(role.error || role.data!==true)throw new Error('此操作只限管理員');
 const [passes,settings]=await Promise.all([context.supabase.from('crypto_passes').select('*').order('created_at',{ascending:false}).limit(200),context.supabase.from('app_settings').select('key,value').in('key',['crypto_pass_enabled','crypto_pass_price_usd','crypto_pass_weeks'])]);if(passes.error || settings.error)throw new Error('暫時未能讀取通行證');
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');const emails:Record<string,string>={};for(const uid of [...new Set((passes.data ?? []).map(p=>p.user_id))]){const user=await db.auth.admin.getUserById(uid);emails[uid]=user.data.user?.email ?? '—';}
 const values=Object.fromEntries((settings.data ?? []).map(r=>[r.key,r.value]));return {passes:passes.data.map(p=>({...p,email:emails[p.user_id]})),values:cryptoSettingsSchema.parse({...values,crypto_pass_weeks:values['crypto_pass_weeks'] ?? 52}),ready:!!process.env['NOWPAYMENTS_API_KEY'] && !!process.env['NOWPAYMENTS_IPN_SECRET']};
});
export const saveCryptoSettings=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>cryptoSettingsSchema.parse(d)).handler(async({data,context})=>{
 const role=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(role.error || role.data!==true)throw new Error('此操作只限管理員');if(data.crypto_pass_enabled)throw new Error('真實付款驗收完成前，通行證保持停用。');
 const r=await context.supabase.from('app_settings').upsert(Object.entries(data).map(([key,value])=>({key,value,updated_by:context.userId})));if(r.error)throw new Error('設定未能儲存');return {ok:true};
});
export const adminCryptoAction=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>z.object({id:z.string().uuid(),action:z.enum(['grant','revoke']),note:z.string().trim().min(3).max(500)}).parse(d)).handler(async({data,context})=>{
 const role=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});if(role.error || role.data!==true)throw new Error('此操作只限管理員');const r=await context.supabase.rpc('admin_crypto_action',{pid:data.id,action:data.action,note:data.note});if(r.error)throw new Error('通行證操作未能完成；請核對狀態及原因');return {ok:true};
});