import { describe, expect, it } from 'vitest';
import { countdown } from './tx-api';

describe('香港賽事倒數', () => {
  it('10月21日18:40賽事在17:22香港時間剩1小時18分', () => {
    expect(countdown('18:40', new Date('2026-10-21T09:22:00Z'), '2026-10-21')).toBe('01:18:00');
  });
  it('沒有賽日亦以香港當日而非瀏覽器當日計算', () => {
    expect(countdown('18:40', new Date('2026-10-21T09:22:00Z'))).toBe('01:18:00');
  });
  it('過了18:40就顯示已開跑', () => {
    expect(countdown('18:40', new Date('2026-10-21T10:41:00Z'), '2026-10-21')).toBe('已開跑');
  });
});