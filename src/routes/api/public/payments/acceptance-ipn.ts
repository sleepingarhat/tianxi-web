import {createFileRoute} from '@tanstack/react-router';
import {cryptoIpnSchema,verifyCryptoSignature} from '@/lib/crypto-pass';
import {acceptanceIdentityMatches} from '@/lib/payment-acceptance';
import type {Json} from '@/integrations/supabase/types';
export const Route=createFileRoute('/api/public/payments/acceptance-ipn')({server:{handlers:{POST:async({request})=>{
 const secret=process.env['NOWPAYMENTS_IPN_SECRET'];
 if(!secret)return Response.json({ok:false},{status:503});
 let raw:unknown;try{const text=await request.text();if(text.length>65536)return Response.json({ok:false},{status:413});raw=JSON.parse(text);}catch{return Response.json({ok:false},{status:400});}
 if(!await verifyCryptoSignature(raw,request.headers.get('x-nowpayments-sig'),secret))return Response.json({ok:false},{status:401});
 const parsed=cryptoIpnSchema.safeParse(raw);if(!parsed.success)return Response.json({ok:false},{status:400});
 const {supabaseAdmin:db}=await import('@/integrations/supabase/client.server');
 const order=await db.from('payment_acceptance_invoices').select('id,invoice_id').eq('id',parsed.data.order_id).maybeSingle();
 if(order.error)return Response.json({ok:false},{status:503});
 if(!order.data || !acceptanceIdentityMatches(order.data,parsed.data))return Response.json({ok:false},{status:400});
 const applied=await db.rpc('apply_payment_acceptance_receipt',{payload:parsed.data as Json});
 return Response.json({ok:!applied.error},{status:applied.error?503:200});
}}}});