import { describe, expect, it } from 'vitest';
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
import { vi } from 'vitest';
import { isMeetingToday, isPastMeetingDate } from './picks.functions';

describe('isPastMeetingDate', () => {
  it('香港午夜後 10-28 屬已完結賽日', () => {
    expect(isPastMeetingDate('2026-10-28', new Date('2026-10-28T19:31:00Z'))).toBe(true);
  });
  it('香港當日晚上 10-28 仍屬當日', () => {
    expect(isPastMeetingDate('2026-10-28', new Date('2026-10-28T15:00:00Z'))).toBe(false);
  });
  it('無效日期不當舊賽日', () => {
    expect(isPastMeetingDate(undefined)).toBe(false);
  });
});

describe('isMeetingToday', () => {
  it('香港當日晚上屬今日賽事', () => {
    expect(isMeetingToday('2026-11-11', new Date('2026-11-11T10:20:00Z'))).toBe(true);
  });
  it('香港午夜後上一日唔屬今日', () => {
    expect(isMeetingToday('2026-11-11', new Date('2026-11-11T16:30:00Z'))).toBe(false);
  });
  it('未知日期唔屬今日', () => {
    expect(isMeetingToday(undefined)).toBe(false);
  });
});
