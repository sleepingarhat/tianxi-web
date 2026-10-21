import { describe, expect, it } from 'vitest';
import { resultsDeliveryVerified } from './results-delivery';

describe('賽後收料完成核實', () => {
  const success = { runId: 123, status: 'completed', conclusion: 'success' };
  it('今日9場官方存檔齊且自己工作成功才核實', () => {
    expect(resultsDeliveryVerified(success, [1,2,3,4,5,6,7,8,9], 9)).toBe(true);
    expect(resultsDeliveryVerified(success, [1,2,3,4,5,6,7,8], 9)).toBe(false);
  });
  it('派送或無自己工作編號不是交付成功', () => {
    expect(resultsDeliveryVerified({ status: 'completed', conclusion: 'success' }, [1], 1)).toBe(false);
    expect(resultsDeliveryVerified({ ...success, status: 'in_progress' }, [1], 1)).toBe(false);
  });
  it('工作失敗及重複場號都不能過關', () => {
    expect(resultsDeliveryVerified({ ...success, conclusion: 'failure' }, [1], 1)).toBe(false);
    expect(resultsDeliveryVerified(success, [1,1], 2)).toBe(false);
  });
});