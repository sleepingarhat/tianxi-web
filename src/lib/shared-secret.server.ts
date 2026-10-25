// 機器對機器共享密鑰（x-cron-secret）—— 一個用途一個密鑰，常數時間比較。
//
//   WEATHER_CRON_SECRET (+_PREVIOUS)        : 舊天氣／賽果 hooks 入口（舊排程已停用；新排程用 LOVABLE_CRON_SECRET）
//   ALERT_HOOK_SECRET   (+_PREVIOUS, _NEXT) : Worker → /api/public/telegram-alert（網站係接收方）
//   WATCH_FEED_SECRET                       : 網站 → Worker /api/watch/events（呢度只負責「發送」）
//
// 舊共用值（WEATHER_CRON_SECRET）後備係「按用途」收窄：
//   - 某用途一旦設定咗專用「目前值」（ALERT_HOOK_SECRET／WATCH_FEED_SECRET），
//     該用途就唔再接受／發送 WEATHER_CRON_SECRET —— 唔使等 LEGACY_CRON_SECRET_FALLBACK=off。
//   - ALERT_HOOK_SECRET_NEXT：預先放入嘅新值，額外接受但唔會停用舊值，用嚟零停機切換。
//   - LEGACY_CRON_SECRET_FALLBACK=off：所有用途一律唔用舊共用值（總開關）。
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

const present = (v: string | undefined): v is string => typeof v === "string" && v.length > 0;

export function alertHookSecrets(e: Env = env()): string[] {
  const out = [
    e["ALERT_HOOK_SECRET"],
    e["ALERT_HOOK_SECRET_PREVIOUS"],
    e["ALERT_HOOK_SECRET_NEXT"],
  ];
  // 只有 ALERT_HOOK_SECRET 未設定（而且總開關未關）先接受舊共用值
  if (!present(e["ALERT_HOOK_SECRET"]) && legacyFallbackEnabled(e))
    out.push(e["WEATHER_CRON_SECRET"]);
  return out.filter(present);
}

/** 網站 → Worker 愛駒 feed 用嘅密鑰：有 WATCH_FEED_SECRET 就只用佢；未設定而總開關未關先用舊共用值。 */
export function watchFeedSenderSecret(e: Env = env()): string | undefined {
  if (present(e["WATCH_FEED_SECRET"])) return e["WATCH_FEED_SECRET"];
  return legacyFallbackEnabled(e) && present(e["WEATHER_CRON_SECRET"])
    ? e["WEATHER_CRON_SECRET"]
    : undefined;
}

/** 入口用：通過回 null，否則回 401。未設定任何密鑰都係 401（同舊行為一致）。 */
export function requireSharedSecret(request: Request, candidates: string[]): Response | null {
  return secretMatches(request.headers.get("x-cron-secret"), candidates)
    ? null
    : new Response("Unauthorized", { status: 401 });
}
