import { z } from 'zod';

export const CRYPTO_STATUSES = {pending:'待付款',waiting:'待付款',confirming:'確認中',confirmed:'確認中',sending:'確認中',finished:'已生效',partially_paid:'不足額',expired:'已過期',failed:'失敗',refunded:'已退款',manual_granted:'人手開通',revoked:'已撤銷'} as const;
export const cryptoSettingsSchema=z.object({crypto_pass_enabled:z.boolean(),crypto_pass_price_usd:z.number().positive().max(100000),crypto_pass_weeks:z.number().int().min(1).max(520)});
export const cryptoIpnSchema=z.object({order_id:z.string().uuid(),invoice_id:z.union([z.string(),z.number()]).transform(String),payment_id:z.union([z.string(),z.number()]).transform(String),payment_status:z.enum(['waiting','confirming','confirmed','sending','partially_paid','finished','failed','refunded','expired']),price_amount:z.coerce.number().positive(),price_currency:z.string().max(10),pay_currency:z.string().max(30),actually_paid:z.coerce.number().nonnegative()}).passthrough();
export function sortKeysDeep(value:unknown):unknown {
 if(Array.isArray(value))return value.map(sortKeysDeep);
 if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>[k,sortKeysDeep(v)]));
 return value;
}
export async function verifyCryptoSignature(body:unknown,signature:string|null,secret:string){
 if(!signature || !/^[a-fA-F0-9]{128}$/.test(signature) || !secret)return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-512'},false,['verify']);
 const bytes=Uint8Array.from(signature.match(/.{2}/g) ?? [],s=>parseInt(s,16));
 return crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(JSON.stringify(sortKeysDeep(body))));
}
export function cryptoPassStart(now:string,foundingEnd:string|null,previousEnd:string|null){return new Date(Math.max(...[now,foundingEnd,previousEnd].filter((v):v is string=>!!v).map(v=>new Date(v).getTime()))).toISOString();}
export function cryptoPassEnd(start:string,weeks:number){return new Date(new Date(start).getTime()+weeks*7*86400000).toISOString();}
export function ignoreCryptoTransition(current:string,incoming:string){
 if(['refunded','revoked','manual_granted'].includes(current))return true;
 if(current==='finished')return incoming!=='refunded';
 const steps=['pending','waiting','confirming','confirmed','sending','partially_paid'];
 const a=steps.indexOf(current),b=steps.indexOf(incoming);return a>=0 && b>=0 && b<a;
}