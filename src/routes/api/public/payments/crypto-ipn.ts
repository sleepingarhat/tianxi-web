import {createFileRoute} from '@tanstack/react-router';
import {cryptoIpnSchema,verifyCryptoSignature,ignoreCryptoTransition} from '@/lib/crypto-pass';
import type {Json} from '@/integrations/supabase/types';
export const Route=createFileRoute('/api/public/payments/crypto-ipn')({server:{handlers:{POST:async({request})=>{
 const secret=process.env['NOWPAYMENTS_IPN_SECRET'];if(!secret)return Response.json({ok:false,error:'not_configured'},{status:503});
 let raw:unknown;try{const text=await request.text();if(text.length>65536)return Response.json({ok:false},{status:413});raw=JSON.parse(text);}catch{return Response.json({ok:false},{status:400});}
 if(!await verifyCryptoSignature(raw,request.headers.get('x-nowpayments-sig'),secret))return Response.json({ok:false},{status:401});
 const parsed=cryptoIpnSchema.safeParse(raw);if(!parsed.success)return Response.json({ok:false,error:'invalid_payment'},{status:400});
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');const env=process.env['NOWPAYMENTS_SANDBOX']==='1'?'sandbox':'live';
 const order=await db.from('crypto_passes').select('id,invoice_id,price_usd,environment,status').eq('id',parsed.data.order_id).maybeSingle();if(order.error)return Response.json({ok:false},{status:503});if(!order.data)return Response.json({ok:false,error:'unknown_order'},{status:404});
 if(order.data.invoice_id!==parsed.data.invoice_id || order.data.environment!==env || Number(order.data.price_usd)!==parsed.data.price_amount || parsed.data.price_currency.toLowerCase()!=='usd')return Response.json({ok:false,error:'identity_mismatch'},{status:400});
 if(ignoreCryptoTransition(order.data.status,parsed.data.payment_status))return Response.json({ok:true});
 const applied=await db.rpc('apply_crypto_ipn',{payload:parsed.data as Json,env});if(applied.error)return Response.json({ok:false,error:'payment_not_saved'},{status:503});
 // Retryable delivery is separate from idempotent granting; no provider failure changes payment status.
 const {runCryptoNotices}=await import('@/lib/crypto-notices.server');try{await runCryptoNotices(parsed.data.order_id);}catch{/* sweep retries durable pending notices */}
 return Response.json({ok:true});
}}}});