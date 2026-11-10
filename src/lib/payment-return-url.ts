import type { StripeEnv } from "./stripe.server";

/** 付款完返回只可以返天喜自己網址；live 只接受正式網域，sandbox 另外接受預覽同本機。 */
const LIVE_ORIGINS = ["https://tianxi.racing", "https://www.tianxi.racing", "https://tianxi-racing.lovable.app"] as const;
const SANDBOX_ORIGINS = [
  ...LIVE_ORIGINS,
  "https://id-preview--8be5fecb-440e-4e5c-94dc-cbdc1f31edcd.lovable.app",
  "https://8be5fecb-440e-4e5c-94dc-cbdc1f31edcd.lovableproject.com",
  "http://localhost:8080",
] as const;

export const CHECKOUT_RETURN_PATH = "/checkout/return?session_id={CHECKOUT_SESSION_ID}";

function trustedUrl(raw: unknown, environment: StripeEnv): URL | null {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.username || url.password) return null;
  const allowed: readonly string[] = environment === "live" ? LIVE_ORIGINS : SANDBOX_ORIGINS;
  return allowed.includes(url.origin) ? url : null;
}

/** Checkout：只取已核實網域，路徑一律由伺服器固定，唔理用戶傳入嘅路徑同參數。 */
export function checkoutReturnUrl(raw: unknown, environment: StripeEnv): string | null {
  const url = trustedUrl(raw, environment);
  return url ? `${url.origin}${CHECKOUT_RETURN_PATH}` : null;
}

/** 帳單管理：返回已核實網域內原本頁面（保留路徑同查詢，去掉 #）。 */
export function portalReturnUrl(raw: unknown, environment: StripeEnv): string | null {
  const url = trustedUrl(raw, environment);
  return url ? `${url.origin}${url.pathname}${url.search}` : null;
}
