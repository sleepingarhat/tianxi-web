import { describe, expect, it, vi } from 'vitest';
import { dividendJobError, retryDividendMeeting, updateDividendAlert, type DividendAlertState, type DividendAlertStore } from './racing-dividends-job';

const start = new Date('2026-10-23T10:00:00Z');
const fail = (error = 'official-dividends-503') => ({ ok: false as const, error, warning: `⚠️ 官方派彩自動核對未齊：2026-10-19（${error}）；保留上次存證，五分鐘後自動重試。` });
const success = { ok: true as const, recovery: '✅ 官方派彩自動核對已恢復：2026-10-19 ST，177 行／11 場，SHA abcdef12' };
function memoryStore() {
  const states = new Map<string, DividendAlertState>();
  const send = vi.fn(async () => ({ sent: true }));
  const store: DividendAlertStore = {
    read: async key => states.get(key) ?? null,
    write: async (key, state) => { states.set(key, { ...state }); },
    send,
  };
  return { states, send, store };
}
describe('派彩工作告警', () => {
  const key = 'dividends:2026-10-19:ST';
  it('第一輪失敗只存failures=1不告警', async () => {
    const m = memoryStore();
    await updateDividendAlert(m.store, key, fail(), start);
    expect(m.send).not.toHaveBeenCalled();
    expect(m.states.get(key)).toEqual({ failures: 1, firstFailedAt: start.toISOString(), lastError: 'official-dividends-503', alertedAt: null, recoveredAt: null });
  });
  it('第二輪告警含錯誤碼、第三輪同碼不再發', async () => {
    const m = memoryStore();
    for (let i = 0; i < 3; i++) await updateDividendAlert(m.store, key, fail(), new Date(start.getTime() + i * 300000));
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(m.send).toHaveBeenCalledWith(fail().warning);
    expect(m.states.get(key)?.failures).toBe(3);
  });
  it('六小時內錯誤改變即再告警', async () => {
    const m = memoryStore();
    await updateDividendAlert(m.store, key, fail(), start);
    await updateDividendAlert(m.store, key, fail(), start);
    await updateDividendAlert(m.store, key, fail('TimeoutError'), start);
    expect(m.send).toHaveBeenCalledTimes(2);
    expect(m.send).toHaveBeenLastCalledWith(fail('TimeoutError').warning);
  });
  it('同碼六小時前不發、滿六小時才可再發', async () => {
    const m = memoryStore();
    await updateDividendAlert(m.store, key, fail(), start);
    await updateDividendAlert(m.store, key, fail(), start);
    await updateDividendAlert(m.store, key, fail(), new Date(start.getTime() + 21600000 - 1));
    expect(m.send).toHaveBeenCalledTimes(1);
    await updateDividendAlert(m.store, key, fail(), new Date(start.getTime() + 21600000));
    expect(m.send).toHaveBeenCalledTimes(2);
  });
  it('已告警成功後只發一次恢復並歸零', async () => {
    const m = memoryStore();
    await updateDividendAlert(m.store, key, fail(), start);
    await updateDividendAlert(m.store, key, fail(), start);
    await updateDividendAlert(m.store, key, success, start);
    await updateDividendAlert(m.store, key, success, start);
    expect(m.send).toHaveBeenCalledTimes(2);
    expect(m.send).toHaveBeenLastCalledWith(success.recovery);
    expect(m.states.get(key)).toMatchObject({ failures: 0, alertedAt: null, recoveredAt: start.toISOString() });
  });
  it('未曾告警成功只歸零', async () => {
    const m = memoryStore();
    await updateDividendAlert(m.store, key, fail(), start);
    await updateDividendAlert(m.store, key, success, start);
    expect(m.send).not.toHaveBeenCalled();
    expect(m.states.get(key)?.failures).toBe(0);
  });
  it('外層job採同樣兩輪門檻與恢復', async () => {
    const m = memoryStore();
    const k = 'dividends:job';
    const f = { ok: false as const, error: 'dividend-meeting-index-failed', warning: '⚠️ 官方派彩自動核對工作失敗（dividend-meeting-index-failed）' };
    await updateDividendAlert(m.store, k, f, start);
    expect(m.send).not.toHaveBeenCalled();
    await updateDividendAlert(m.store, k, f, start);
    expect(m.states.get(k)?.failures).toBe(2);
    expect(m.send).toHaveBeenCalledWith(f.warning);
    await updateDividendAlert(m.store, k, { ok: true, recovery: '✅ 官方派彩自動核對工作已恢復' }, start);
    expect(m.send).toHaveBeenCalledTimes(2);
    expect(m.states.get(k)?.failures).toBe(0);
  });
  it('狀態讀失敗當作第一次，不告警也不拋錯', async () => {
    const m = memoryStore();
    m.store.read = async () => { throw new Error('offline'); };
    await updateDividendAlert(m.store, key, fail(), start);
    await updateDividendAlert(m.store, key, fail(), start);
    expect(m.states.get(key)?.failures).toBe(1);
    expect(m.send).not.toHaveBeenCalled();
  });
  it('狀態寫失敗不告警不令工作失敗', async () => {
    const m = memoryStore();
    await updateDividendAlert(m.store, key, fail(), start);
    m.store.write = async () => { throw new Error('offline'); };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(updateDividendAlert(m.store, key, fail(), start)).resolves.toBeUndefined();
    expect(m.send).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
  it('送達失敗不當成已通知，下輪再試', async () => {
    const m = memoryStore();
    await updateDividendAlert(m.store, key, fail(), start);
    m.send.mockResolvedValueOnce({ sent: false });
    await updateDividendAlert(m.store, key, fail(), start);
    expect(m.states.get(key)?.alertedAt).toBeNull();
    await updateDividendAlert(m.store, key, fail(), start);
    expect(m.states.get(key)?.alertedAt).toBe(start.toISOString());
  });
  it('重試第一次throw第二次成功只等3000ms，attempts=2無告警', async () => {
    const m = memoryStore();
    const collect = vi.fn().mockRejectedValueOnce(new Error('503')).mockResolvedValueOnce({ rows: 177, raceCount: 11 });
    const wait = vi.fn(async (_ms: number) => {});
    const r = await retryDividendMeeting(collect, wait);
    expect(r).toEqual({ ok: true, result: { rows: 177, raceCount: 11 }, attempts: 2 });
    expect(wait).toHaveBeenCalledExactlyOnceWith(3000);
    if (r.ok) await updateDividendAlert(m.store, key, success, start);
    expect(m.send).not.toHaveBeenCalled();
  });
  it('兩次都失敗才回失敗，保留第二次錯誤', async () => {
    const collect = vi.fn().mockRejectedValueOnce(new Error('503')).mockRejectedValueOnce(new Error('dividend-coverage-incomplete'));
    expect(await retryDividendMeeting(collect, async () => {})).toEqual({ ok: false, error: 'dividend-coverage-incomplete', attempts: 2 });
    expect(collect).toHaveBeenCalledTimes(2);
  });
  it('錯誤訊息最多120字，空message保留TimeoutError', () => {
    expect(dividendJobError(new Error('x'.repeat(150)))).toHaveLength(120);
    const e = new Error(''); e.name = 'TimeoutError';
    expect(dividendJobError(e)).toBe('TimeoutError');
  });
});