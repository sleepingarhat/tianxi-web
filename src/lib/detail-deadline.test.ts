import { describe, expect, it, vi } from 'vitest';
import { detailDeadline } from './detail-deadline';
describe('independent detail deadlines', () => {
  it('stops a stalled section at 15 seconds without blocking another section', async () => {
    vi.useFakeTimers();
    try {
      const stalled = detailDeadline(() => new Promise(() => {}));
      const rejected = expect(stalled).rejects.toThrow('讀取暫未完成');
      expect(await detailDeadline(async () => 118)).toBe(118);
      await vi.advanceTimersByTimeAsync(15_000);
      await rejected;
    } finally { vi.useRealTimers(); }
  });
});