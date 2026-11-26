/** Fixed public racing projections only; never expose arbitrary query access. */
import { isRacingThrottle, racingReadFailureMessage, racingThrottleDelayMs, RACING_READ_FAILED_MESSAGE } from './racing-read-error';

const MAX_ATTEMPTS = 3;
const defaultSleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });
let sleepImpl: (ms: number) => Promise<void> = defaultSleep;
let pausedUntil = 0;

/** Tests skip the real backoff. Production uses the default timer. */
export function setRacingReadSleepForTests(sleep: ((ms: number) => Promise<void>) | null) {
  sleepImpl = sleep ?? defaultSleep;
  pausedUntil = 0;
}

async function waitOutPause() {
  const base = pausedUntil - Date.now();
  if (base <= 0) return;
  const spread = Math.floor(Math.random() * 400);
  await sleepImpl(base + spread);
}

function extendPause(ms: number) {
  const until = Date.now() + ms;
  if (until > pausedUntil) pausedUntil = until;
}

export async function publicRacingQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const token = process.env["CLOUDFLARE_API_KEY"], key = process.env["LOVABLE_API_KEY"], account = process.env["CLOUDFLARE_ACCOUNT_ID"];
  if (!token || !key || !account) throw new Error(RACING_READ_FAILED_MESSAGE);
  const url = `${(process.env["CONNECTOR_GATEWAY_BASE_URL"] ?? "https://connector-gateway.lovable.dev").replace(/\/$/, "")}/cloudflare/client/v4/accounts/${account}/d1/database/aad1636e-869a-43f5-aa95-4a19e3aa5517/query`;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await waitOutPause();
    const response = await fetch(url, {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "X-Connection-Api-Key": token, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }), signal: AbortSignal.timeout(25_000),
    });
    const detail = await response.text();
    const throttled = isRacingThrottle(response.status, detail);
    if (!response.ok || throttled) {
      console.error(`Cloudflare racing read [${response.status}]: ${detail}`);
      if (throttled && attempt < MAX_ATTEMPTS - 1) {
        extendPause(racingThrottleDelayMs(attempt, response.headers.get('retry-after')));
        continue;
      }
      throw new Error(racingReadFailureMessage(response.status, detail));
    }
    let body: { success?: boolean; result?: { success?: boolean; results?: T[] }[] };
    try { body = JSON.parse(detail) as { success?: boolean; result?: { success?: boolean; results?: T[] }[] }; }
    catch { throw new Error("賽馬核對資料未能完整讀取"); }
    if (!body.success || body.result?.[0]?.success === false || !Array.isArray(body.result?.[0]?.results)) throw new Error("賽馬核對資料未能完整讀取");
    return body.result[0].results;
  }
  throw new Error(racingReadFailureMessage(429, ''));
}
