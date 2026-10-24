import { z } from 'zod';
export const ACCEPTANCE_USD = 10;
export const ACCEPTANCE_CURRENCY = 'usdtbsc';
export const acceptanceInvoiceSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  invoice_url: z.string().url().refine(value => {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'nowpayments.io' || url.hostname.endsWith('.nowpayments.io'));
  }),
});
export function acceptanceIdentityMatches(order: {id: string; invoice_id: string | null}, receipt: {order_id: string; invoice_id: string; price_amount: number; price_currency: string; pay_currency: string}) {
  return order.id === receipt.order_id && order.invoice_id !== null && order.invoice_id === receipt.invoice_id && receipt.price_amount === ACCEPTANCE_USD && receipt.price_currency.toLowerCase() === 'usd' && receipt.pay_currency.toLowerCase() === ACCEPTANCE_CURRENCY;
}