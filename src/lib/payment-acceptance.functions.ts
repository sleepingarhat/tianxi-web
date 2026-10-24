import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { ACCEPTANCE_USD, ACCEPTANCE_CURRENCY, acceptanceInvoiceSchema } from './payment-acceptance';

export const listAcceptanceInvoices = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async ({context}) => {
  const role = await context.supabase.rpc('has_role', {_user_id:context.userId, _role:'admin'});
  if (role.error || role.data !== true) throw new Error('此操作只限管理員');
  const rows = await context.supabase.from('payment_acceptance_invoices').select('id,invoice_url,status,actually_paid,created_at,updated_at').eq('owner_id',context.userId).order('created_at',{ascending:false}).limit(20);
  if (rows.error) throw new Error('未能讀取驗收付款');
  return rows.data;
});

export const createAcceptanceInvoice = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((value:unknown) => z.object({confirm:z.literal(true)}).parse(value)).handler(async ({context}) => {
  const role = await context.supabase.rpc('has_role', {_user_id:context.userId, _role:'admin'});
  if (role.error || role.data !== true) throw new Error('此操作只限管理員');
  const key = process.env['NOWPAYMENTS_API_KEY'];
  if (!key || !process.env['NOWPAYMENTS_IPN_SECRET']) throw new Error('付款憑證未設定');
  // Explicit live acceptance is independent of the disabled production pass checkout.
  const base = 'https://api.nowpayments.io/v1';
  const minimum = await fetch(`${base}/min-amount?currency_from=${ACCEPTANCE_CURRENCY}&currency_to=${ACCEPTANCE_CURRENCY}&fiat_equivalent=usd&is_fixed_rate=true&is_fee_paid_by_user=false`, {headers:{'x-api-key':key},signal:AbortSignal.timeout(15000)});
  if (!minimum.ok) throw new Error(`未能核實最低付款額（${minimum.status}）`);
  const minimumData = z.object({fiat_equivalent:z.number().nonnegative()}).parse(await minimum.json());
  if (minimumData.fiat_equivalent >= ACCEPTANCE_USD) throw new Error('平台最低付款額已達10美元，暫停建立小額付款');
  const {supabaseAdmin:db} = await import('@/integrations/supabase/client.server');
  const reserved = await db.rpc('reserve_payment_acceptance',{uid:context.userId});
  if (reserved.error || !reserved.data) throw new Error('未能建立驗收訂單，或已達每日上限');
  const existing = await db.from('payment_acceptance_invoices').select('invoice_url,created_at').eq('id',reserved.data).single();
  if (existing.error) throw new Error('未能核實驗收訂單');
  if (existing.data.invoice_url) return {url:existing.data.invoice_url};
  // Atomically claim the provider write. Never repeat an ambiguous invoice creation.
  const claimed = await db.from('payment_acceptance_invoices').update({status:'waiting'}).eq('id',reserved.data).eq('status','pending').is('invoice_id',null).select('id');
  if (claimed.error || claimed.data?.length !== 1) throw new Error('上次付款連結建立中或結果未明，請先核對NOWPayments紀錄，唔好重複建立');
  const response = await fetch(`${base}/invoice`, {method:'POST', headers:{'content-type':'application/json','x-api-key':key},body:JSON.stringify({price_amount:ACCEPTANCE_USD,price_currency:'usd',pay_currency:ACCEPTANCE_CURRENCY,order_id:reserved.data,order_description:'天喜10美元收款驗收（不授予會籍）',ipn_callback_url:'https://tianxi.racing/api/public/payments/acceptance-ipn',success_url:'https://tianxi.racing/admin/settings',cancel_url:'https://tianxi.racing/admin/settings',is_fixed_rate:true,is_fee_paid_by_user:false}),signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`未能建立付款連結（${response.status}）；請先核對平台紀錄`);
  const invoice = acceptanceInvoiceSchema.parse(await response.json());
  const saved = await db.from('payment_acceptance_invoices').update({invoice_id:invoice.id,invoice_url:invoice.invoice_url}).eq('id',reserved.data).is('invoice_id',null).select('id');
  if (saved.error || saved.data?.length !== 1) throw new Error('付款連結未能保存，請先核對平台紀錄');
  return {url:invoice.invoice_url};
});