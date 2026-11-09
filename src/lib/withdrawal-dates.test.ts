import { describe, expect, it } from 'vitest';
import { defaultWithdrawalDate, hkStamp } from './withdrawal-dates';

describe('退出馬追蹤賽日', () => {
  it('預設最近一個已到嘅賽日，唔用寫死嘅10月21日', () => {
    expect(defaultWithdrawalDate(['2026-11-11', '2026-11-08', '2026-10-21'], '2026-11-09')).toBe('2026-11-08');
  });
  it('賽日當日就用當日', () => {
    expect(defaultWithdrawalDate(['2026-11-11', '2026-11-08'], '2026-11-11')).toBe('2026-11-11');
  });
  it('冇存檔就返回 null', () => {
    expect(defaultWithdrawalDate([], '2026-11-09')).toBeNull();
  });
});

describe('香港時間顯示', () => {
  it('UTC 轉香港時間', () => {
    expect(hkStamp('2026-10-21T09:10:00.000Z')).toBe('2026-10-21 17:10 HKT');
    expect(hkStamp('2026-10-21T14:37:02.269579+00:00')).toBe('2026-10-21 22:37 HKT');
  });
  it('跨日照計香港日期', () => {
    expect(hkStamp('2026-11-08T16:30:00Z')).toBe('2026-11-09 00:30 HKT');
  });
  it('無效值唔會變 NaN', () => {
    expect(hkStamp(null)).toBeNull();
    expect(hkStamp('官方未提供')).toBe('官方未提供');
  });
});
