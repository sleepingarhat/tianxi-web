import { FrozenEvidenceError } from './frozen-racing';

/** Gateway throttling. 429 and 503 from the D1 HTTP API, plus Cloudflare 971 / 1015 bodies. */
const THROTTLE_BODY = /"code"\s*:\s*971\b|please wait and consider throttling|error code:\s*1015|too many requests/i;

export function isRacingThrottle(status: number, body: string): boolean {
  if (status === 429 || status === 503) return true;
  return THROTTLE_BODY.test(body);
}

export const RACING_BUSY_MESSAGE = '資料服務繁忙，請稍後再試';
export const RACING_READ_FAILED_MESSAGE = '賽馬核對資料暫時未能讀取';

/** User-facing read failure. Never includes the gateway body. */
export function racingReadFailureMessage(status: number, body: string): string {
  return isRacingThrottle(status, body) ? RACING_BUSY_MESSAGE : RACING_READ_FAILED_MESSAGE;
}

const BASE_MS = 400;
const CAP_MS = 2_500;
const JITTER_MS = 350;

/** Exponential backoff with jitter, capped so a long Retry-After cannot stall the page. */
export function racingThrottleDelayMs(attempt: number, retryAfter: string | null, random: () => number = Math.random): number {
  const header = retryAfter == null || retryAfter.trim() === '' ? Number.NaN : Number(retryAfter);
  const headerMs = Number.isFinite(header) && header >= 0 ? header * 1000 : 0;
  const exponential = BASE_MS * 2 ** Math.max(0, attempt);
  const jitter = Math.floor(Math.min(1, Math.max(0, random())) * JITTER_MS);
  return Math.min(CAP_MS, Math.max(headerMs, exponential) + jitter);
}

const INFRA_LEAK = /"errors"\s*:|"code"\s*:\s*971\b|cloudflare|<\s*!doctype|<\s*html|please wait and consider throttling/i;

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return '';
}

/** Keep freeze-evidence errors. Replace leaked gateway JSON with the short busy message. */
export function presentRacingReadError(error: unknown): Error {
  if (error instanceof FrozenEvidenceError) return error;
  const message = errorText(error);
  if (INFRA_LEAK.test(message)) return new Error(RACING_BUSY_MESSAGE);
  if (error instanceof Error) return error;
  return new Error(message || '未知錯誤');
}
