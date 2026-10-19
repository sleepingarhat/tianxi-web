import { describe, expect, it, vi } from 'vitest';
import { optionalRacingReference } from './optional-racing-reference';

describe('可選顯示參考不阻塞原凍結核對', () => {
  it('掛起的顯示參考限時返回null並取消，不接受遲到參考', async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      let complete: ((value: string) => void) | undefined;
      const result = optionalRacingReference<string>(s => {
        signal = s;
        return new Promise(resolve => { complete = resolve; });
      });
      await vi.advanceTimersByTimeAsync(3_000);
      expect(await result).toBeNull();
      expect(signal?.aborted).toBe(true);
      complete?.('late-reference');
      expect(await result).toBeNull();
    } finally { vi.useRealTimers(); }
  });
  it('成功參考原樣返回，失敗不造資料', async () => {
    expect(await optionalRacingReference(async () => ({ distance: 1400 }))).toEqual({ distance: 1400 });
    expect(await optionalRacingReference(async () => { throw new Error('offline'); })).toBeNull();
  });
});