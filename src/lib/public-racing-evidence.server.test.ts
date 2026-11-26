import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publicRacingQuery, setRacingReadSleepForTests } from './public-racing-evidence.server';

const GATEWAY = '{"success":false,"errors":[{"code":971,"message":"Please wait and consider throttling your request speed"}],"messages":[],"result":null}';
const ok = (rows: unknown[]) => JSON.stringify({ success: true, result: [{ success: true, results: rows }] });

beforeEach(() => {
  vi.stubEnv('CLOUDFLARE_API_KEY', 'token');
  vi.stubEnv('LOVABLE_API_KEY', 'key');
  vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'account');
  setRacingReadSleepForTests(async () => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  setRacingReadSleepForTests(null);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('D1 閘道限流會退避，而且唔把原文交俾頁面', () => {
  it('429 之後先退避再重試成功', async () => {
    const sleeps: number[] = [];
    setRacingReadSleepForTests(async (ms) => { sleeps.push(ms); });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(GATEWAY, { status: 429, headers: { 'retry-after': '1' } }))
      .mockResolvedValueOnce(new Response(ok([{ id: 7 }]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(publicRacingQuery('select 1')).resolves.toEqual([{ id: 7 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleeps.some(ms => ms >= 400)).toBe(true);
  });
  it('連續 429 用盡次數後只回繁忙，唔包含 JSON', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(GATEWAY, { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(publicRacingQuery('select 1')).rejects.toThrow('資料服務繁忙，請稍後再試');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await expect(publicRacingQuery('select 1')).rejects.not.toThrow(/971|success|throttl/i);
  });
  it('400 唔重試，而且唔回傳 SQL 或正文', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"error":"bad sql secret-token"}', { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(publicRacingQuery('select secret')).rejects.toThrow('賽馬核對資料暫時未能讀取');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await publicRacingQuery('select secret').catch((error: Error) => {
      expect(error.message).not.toContain('secret');
      expect(error.message).not.toContain('{');
    });
  });
  it('200 包住 971 都當限流再試', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(GATEWAY, { status: 200 }))
      .mockResolvedValueOnce(new Response(ok([{ ok: 1 }]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(publicRacingQuery('select 1')).resolves.toEqual([{ ok: 1 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('網絡中斷唔會連打', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('socket hang up'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(publicRacingQuery('select 1')).rejects.toThrow('socket hang up');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('缺少憑證唔會發請求', async () => {
    vi.stubEnv('CLOUDFLARE_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(publicRacingQuery('select 1')).rejects.toThrow('賽馬核對資料暫時未能讀取');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
