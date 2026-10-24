import {describe,it,expect} from 'vitest';
import {ACCEPTANCE_USD,ACCEPTANCE_CURRENCY,acceptanceIdentityMatches,acceptanceInvoiceSchema} from './payment-acceptance';
const order={id:'owner-order',invoice_id:'invoice-1'};
const receipt={order_id:'owner-order',invoice_id:'invoice-1',price_amount:10,price_currency:'usd',pay_currency:'usdtbsc'};
describe('獨立小額正式驗收',()=>{
 it('BSC只收10美元而非416美元方案',()=>{expect(ACCEPTANCE_USD).toBe(10);expect(ACCEPTANCE_CURRENCY).toBe('usdtbsc');expect(acceptanceIdentityMatches(order,receipt)).toBe(true);expect(acceptanceIdentityMatches(order,{...receipt,price_amount:416})).toBe(false);});
 it('拒絕錯訂單及錯invoice',()=>{expect(acceptanceIdentityMatches(order,{...receipt,order_id:'other'})).toBe(false);expect(acceptanceIdentityMatches(order,{...receipt,invoice_id:'other'})).toBe(false);});
 it('拒絕錯鏈及非美元',()=>{expect(acceptanceIdentityMatches(order,{...receipt,pay_currency:'usdttrc20'})).toBe(false);expect(acceptanceIdentityMatches(order,{...receipt,price_currency:'hkd'})).toBe(false);});
 it('付款連結只允許官方HTTPS',()=>{expect(acceptanceInvoiceSchema.safeParse({id:1,invoice_url:'https://nowpayments.io/payment/x'}).success).toBe(true);expect(acceptanceInvoiceSchema.safeParse({id:1,invoice_url:'https://nowpayments.io.evil.example/x'}).success).toBe(false);});
});