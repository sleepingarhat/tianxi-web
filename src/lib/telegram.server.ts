import { timingSafeEqual, createHash } from 'node:crypto';
export function validTelegramSecret(actual: string) {
  const expected = process.env['TELEGRAM_WEBHOOK_SECRET'];
  return !!expected && expected.length >= 32 && timingSafeEqual(createHash('sha256').update(actual).digest(), createHash('sha256').update(expected).digest());
}
export function telegramConfigured() { return !!process.env['TIANXI_RACING_BOT_TOKEN'] && !!process.env['TELEGRAM_WEBHOOK_SECRET'] && !!process.env['TELEGRAM_PRO_CHAT_ID']; }
export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<{ok:boolean;result?:T;error_code?:number;description?:string;parameters?:{retry_after?:number}}> {
  const token=process.env['TIANXI_RACING_BOT_TOKEN'];
  if (!token) return {ok:false,description:'會員 Telegram Bot 尚未設定'};
  try {
    const response=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
    const result=await response.json() as {ok:boolean;result?:T;error_code?:number;description?:string;parameters?:{retry_after?:number}};
    return {...result,...(result.description ? {description:result.description.split(token).join('[redacted]')} : {})};
  } catch { return {ok:false,description:'Telegram 暫時未能連接'}; }
}
export async function tgRetry<T=unknown>(method:string,body:Record<string,unknown>) {
  const result=await tg<T>(method,body);
  if(result.error_code!==429)return result;
  const seconds=result.parameters?.retry_after;
  // Long throttling must be retried by the next durable job, not exhaust the Worker.
  if(!seconds || seconds>30)return result;
  await new Promise(resolve=>setTimeout(resolve,seconds*1000)); return tg<T>(method,body);
}