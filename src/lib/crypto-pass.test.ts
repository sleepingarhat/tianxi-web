import {describe,it,expect} from 'vitest';
import {cryptoPassStart,cryptoPassEnd,verifyCryptoSignature,sortKeysDeep,cryptoIpnSchema,cryptoSettingsSchema,ignoreCryptoTransition} from './crypto-pass';
describe('crypto pass rules',()=>{
 it('uses USD416 for 52 weeks',()=>{expect(cryptoSettingsSchema.parse({crypto_pass_enabled:false,crypto_pass_price_usd:416,crypto_pass_weeks:52}).crypto_pass_price_usd).toBe(416);});
 it('grants exactly 364 days',()=>{expect(cryptoPassEnd('2026-10-23T00:00:00Z',52)).toBe('2027-10-22T00:00:00.000Z');});
 it('starts after founding year',()=>{expect(cryptoPassStart('2026-10-23T00:00:00Z','2027-10-22T00:00:00Z',null)).toBe('2027-10-22T00:00:00.000Z');});
 it('stacks after a previous pass',()=>{expect(cryptoPassStart('2026-10-23T00:00:00Z',null,'2028-01-01T00:00:00Z')).toBe('2028-01-01T00:00:00.000Z');});
 it('rejects invalid signatures',async()=>{expect(await verifyCryptoSignature({a:1},'0'.repeat(128),'test-only')).toBe(false);});
 it('verifies sorted nested SHA512 signatures',async()=>{const body={z:[{b:2,a:1}],a:1};const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('test-only'),{name:'HMAC',hash:'SHA-512'},false,['sign']);const signed=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(JSON.stringify(sortKeysDeep(body))));const signature=Array.from(new Uint8Array(signed),v=>v.toString(16).padStart(2,'0')).join('');expect(await verifyCryptoSignature(body,signature,'test-only')).toBe(true);expect(await verifyCryptoSignature({...body,a:2},signature,'test-only')).toBe(false);});
 it('accepts partially paid without inventing finished',()=>{expect(cryptoIpnSchema.parse({order_id:'f018c6e8-b38c-4547-9795-a0ee89667bcf',invoice_id:1,payment_id:2,payment_status:'partially_paid',price_amount:416,price_currency:'usd',pay_currency:'usdt',actually_paid:100}).payment_status).toBe('partially_paid');});
 it('replaying finished does not grant twice',()=>{expect(ignoreCryptoTransition('finished','finished')).toBe(true);});
 it('finished never downgrades to waiting',()=>{expect(ignoreCryptoTransition('finished','waiting')).toBe(true);});
 it('finished can be refunded',()=>{expect(ignoreCryptoTransition('finished','refunded')).toBe(false);});
 it('refunded cannot be reactivated by a late finished event',()=>{expect(ignoreCryptoTransition('refunded','finished')).toBe(true);});
 it('older intermediate events cannot roll progress back',()=>{expect(ignoreCryptoTransition('sending','confirming')).toBe(true);});
});