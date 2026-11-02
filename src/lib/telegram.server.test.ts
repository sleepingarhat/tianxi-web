import { afterEach, expect, it, vi } from 'vitest';
import { memberBotConfigured, proChannelConfigured, tg, telegramWebhookSecret, validTelegramSecret } from './telegram.server';

const MEMBER_KEY = 'member-connection-key-0123456789abcdef';
const ENGINE_KEY = 'engine-connection-key-0123456789abcdef';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('webhook secret is derived from the member bot key and verified', () => {
  vi.stubEnv('TELEGRAM_API_KEY_1', MEMBER_KEY);
  const secret = telegramWebhookSecret();
  expect(secret).toBeTruthy();
  expect(validTelegramSecret(secret!)).toBe(true);
  expect(validTelegramSecret('wrong-value')).toBe(false);
});

it('a derived secret is worthless without the member bot key', () => {
  vi.stubEnv('TELEGRAM_API_KEY_1', MEMBER_KEY);
  const secret = telegramWebhookSecret()!;
  vi.stubEnv('TELEGRAM_API_KEY_1', 'a'.repeat(40));
  expect(validTelegramSecret(secret)).toBe(false);
});

it('engine alert bot key is never substituted for the member bot', async () => {
  vi.stubEnv('TELEGRAM_API_KEY', ENGINE_KEY);
  vi.stubEnv('LOVABLE_API_KEY', 'gateway-key');
  vi.stubEnv('TELEGRAM_API_KEY_1', '');
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  expect(memberBotConfigured()).toBe(false);
  expect((await tg('sendMessage', {})).ok).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('sends through the connector gateway with the member bot connection key', async () => {
  vi.stubEnv('TELEGRAM_API_KEY_1', MEMBER_KEY);
  vi.stubEnv('TELEGRAM_API_KEY', ENGINE_KEY);
  vi.stubEnv('LOVABLE_API_KEY', 'gateway-key');
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ ok: true, result: 1 }));
  vi.stubGlobal('fetch', fetchMock);
  expect(memberBotConfigured()).toBe(true);
  const r = await tg('sendMessage', { chat_id: 7, text: 'hi' });
  expect(r.ok).toBe(true);
  const [url, init] = fetchMock.mock.calls[0]!;
  expect(url).toBe('https://connector-gateway.lovable.dev/telegram/sendMessage');
  const headers = init.headers as Record<string, string>;
  expect(headers['X-Connection-Api-Key']).toBe(MEMBER_KEY);
  expect(headers['Authorization']).toBe('Bearer gateway-key');
  expect(JSON.stringify(init)).not.toContain(ENGINE_KEY);
});

it('member bot credential never escapes returned provider errors', async () => {
  vi.stubEnv('TELEGRAM_API_KEY_1', MEMBER_KEY);
  vi.stubEnv('LOVABLE_API_KEY', 'gateway-key');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(`{"ok":false,"description":"${MEMBER_KEY} invalid"}`, { status: 401 })));
  const r = await tg('getMe', {});
  expect(r.ok).toBe(false);
  expect(r.description).toBe('[redacted] invalid');
});

it('non-JSON gateway failures report a status instead of throwing', async () => {
  vi.stubEnv('TELEGRAM_API_KEY_1', MEMBER_KEY);
  vi.stubEnv('LOVABLE_API_KEY', 'gateway-key');
  vi.stubGlobal('fetch', vi.fn(async () => new Response('bad gateway', { status: 502 })));
  const r = await tg('getMe', {});
  expect(r.ok).toBe(false);
  expect(r.description).toBe('Telegram 回應無法解讀 [502]');
});

it('Pro channel side stays off until the channel id is set', () => {
  vi.stubEnv('TELEGRAM_API_KEY_1', MEMBER_KEY);
  vi.stubEnv('LOVABLE_API_KEY', 'gateway-key');
  vi.stubEnv('TELEGRAM_PRO_CHAT_ID', '');
  expect(memberBotConfigured()).toBe(true);
  expect(proChannelConfigured()).toBe(false);
  vi.stubEnv('TELEGRAM_PRO_CHAT_ID', '-1001234567890');
  expect(proChannelConfigured()).toBe(true);
});
