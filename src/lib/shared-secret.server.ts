// 機器對機器共享密鑰（x-cron-secret）—— 一個用途一個密鑰，常數時間比較。
//
//   WEATHER_CRON_SECRET (+_PREVIOUS) : 舊天氣／賽果 hooks 入口（舊排程已停用；新排程用 LOVABLE_CRON_SECRET）
//   ALERT_HOOK_SECRET   (+_PREVIOUS) : Worker → /api/public/telegram-alert
//   WATCH_FEED_SECRET                : 網站 → Worker /api/watch/events（呢度只負責「發送」）
//
// LEGACY_CRON_SECRET_FALLBACK=off 之後：telegram-alert 唔再接受 WEATHER_CRON_SECRET，
// 愛駒 feed 亦唔再用 WEATHER_CRON_SECRET 代替 WATCH_FEED_SECRET。
// 密鑰值只喺記憶體比較，唔會寫入回應或日誌。

import { createHash, timingSafeEqual } from "node:crypto";

type Env = Record<string, string | undefined>;
const env = (): Env => process.env as Env;

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** 常數時間比較：hash 成固定長度先比較，所有候選都會比一次。 */
export function secretMatches(
  given: string | null | undefined,
  candidates: Array<string | undefined>,
): boolean {
  const valid = candidates.filter((v): v is string => typeof v === "string" && v.length > 0);
  if (!given || !valid.length) return false;
  const g = digest(given);
  let ok = false;
  for (const c of valid) ok = timingSafeEqual(g, digest(c)) || ok;
  return ok;
}

export function legacyFallbackEnabled(e: Env = env()): boolean {
  return (e["LEGACY_CRON_SECRET_FALLBACK"] ?? "").trim().toLowerCase() !== "off";
}

export function weatherHookSecrets(e: Env = env()): string[] {
  return [e["WEATHER_CRON_SECRET"], e["WEATHER_CRON_SECRET_PREVIOUS"]].filter(
    (v): v is string => !!v,
  );
}

export function alertHookSecrets(e: Env = env()): string[] {
  const out = [e["ALERT_HOOK_SECRET"], e["ALERT_HOOK_SECRET_PREVIOUS"]];
  if (legacyFallbackEnabled(e)) out.push(e["WEATHER_CRON_SECRET"]);
  return out.filter((v): v is string => !!v);
}

/** 網站 → Worker 愛駒 feed 用嘅密鑰。 */
export function watchFeedSenderSecret(e: Env = env()): string | undefined {
  return (
    e["WATCH_FEED_SECRET"] ||
    (legacyFallbackEnabled(e) ? e["WEATHER_CRON_SECRET"] : undefined) ||
    undefined
  );
}

/** 入口用：通過回 null，否則回 401。未設定任何密鑰都係 401（同舊行為一致）。 */
export function requireSharedSecret(request: Request, candidates: string[]): Response | null {
  return secretMatches(request.headers.get("x-cron-secret"), candidates)
    ? null
    : new Response("Unauthorized", { status: 401 });
}
