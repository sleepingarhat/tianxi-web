import { describe, expect, it } from 'vitest';
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
import { vi } from 'vitest';
import { isPastMeetingDate } from './picks.functions';

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
