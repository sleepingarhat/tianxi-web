import { timingSafeEqual, createHash } from 'node:crypto';

/**
 * 會員通知用返自己個 Bot（@tianxi_racing_bot）。引擎告警 Bot 有另一個連接，
 * 佢嘅憑證永唔可以頂替呢度：否則會員會收到嚟自告警身分嘅私訊。
 */
const MEMBER_BOT_KEY_ENV = 'TELEGRAM_API_KEY_1';

type TgResponse<T> = {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
  parameters?: { retry_after?: number };
};

function memberBotKey(): string | undefined {
  const key = process.env[MEMBER_BOT_KEY_ENV];
  return key && key.length >= 16 ? key : undefined;
}

function gatewayBase(): string {
  const base = process.env['CONNECTOR_GATEWAY_BASE_URL'] ?? 'https://connector-gateway.lovable.dev';
  return `${base.replace(/\/$/, '')}/telegram`;
}

/** 會員 Bot 可唔可以 send 私訊：要佢自己個連接金鑰加閘門金鑰。 */
export function memberBotConfigured(): boolean {
  return !!memberBotKey() && !!process.env['LOVABLE_API_KEY'];
}

/** Pro 頻道一侧（批加入、巡查）可唔可以行。 */
export function proChannelConfigured(): boolean {
  return memberBotConfigured() && !!process.env['TELEGRAM_PRO_CHAT_ID'];
}

/** 舊叫法保留：兩者皆備先算「已設定」。 */
export function telegramConfigured(): boolean {
  return proChannelConfigured();
}

/**
 * 回呼密鑰由會員 Bot 自己個連接金鑰推導，唔使另存或貼第二條憑證。
 * Telegram 每次派送都會帶返同一條值，路由以常數時間比較。
 */
export function telegramWebhookSecret(): string | undefined {
  const key = memberBotKey();
  return key ? createHash('sha256').update(`telegram-webhook:${key}`).digest('base64url') : undefined;
}

export function validTelegramSecret(actual: string) {
  const expected = telegramWebhookSecret();
  return (
    !!expected &&
    expected.length >= 32 &&
    timingSafeEqual(
      createHash('sha256').update(actual).digest(),
      createHash('sha256').update(expected).digest(),
    )
  );
}

export async function tg<T = unknown>(
  method: string,
  body: Record<string, unknown>,
): Promise<TgResponse<T>> {
  const key = memberBotKey();
  const gatewayKey = process.env['LOVABLE_API_KEY'];
  if (!key || !gatewayKey) return { ok: false, description: '會員 Telegram Bot 尚未設定' };
  try {
    const response = await fetch(`${gatewayBase()}/${method}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${gatewayKey}`,
        'X-Connection-Api-Key': key,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    // The connection key must never come back in a stored error or a log line.
    const text = (await response.text()).split(key).join('[redacted]');
    let result: TgResponse<T>;
    try {
      result = JSON.parse(text) as TgResponse<T>;
    } catch {
      return { ok: false, description: `Telegram 回應無法解讀 [${response.status}]` };
    }
    return result;
  } catch {
    return { ok: false, description: 'Telegram 暫時未能連接' };
  }
}

export async function tgRetry<T = unknown>(method: string, body: Record<string, unknown>) {
  const result = await tg<T>(method, body);
  if (result.error_code !== 429) return result;
  const seconds = result.parameters?.retry_after;
  // Long throttling must be retried by the next durable job, not exhaust the Worker.
  if (!seconds || seconds > 30) return result;
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  return tg<T>(method, body);
}
