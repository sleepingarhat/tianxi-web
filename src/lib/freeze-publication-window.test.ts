import { describe, expect, it } from 'vitest';
import { freezePublicationPending, freezePublicationDeadline, FREEZE_PUBLICATION_GRACE_MS } from './freeze-publication-window';

const lockAt = '2026-10-21T09:10:00.000Z';
describe('T90至T60副本等待窗口', () => {
  it('容許30分鐘，今日截止17:40HKT', () => {
    expect(FREEZE_PUBLICATION_GRACE_MS).toBe(1_800_000);
    expect(freezePublicationDeadline(lockAt)).toBe('2026-10-21T09:40:00.000Z');
  });
  it('鎖點及T60含等號，10分15秒缺副本仍等待', () => {
    for (const now of ['09:10:00.000', '09:20:15.286', '09:40:00.000']) {
      expect(freezePublicationPending(lockAt, 'no-archive', Date.parse(`2026-10-21T${now}Z`))).toBe(true);
    }
  });
  it('鎖點前及T60後不能標等待', () => {
    expect(freezePublicationPending(lockAt, 'no-archive', Date.parse('2026-10-21T09:09:59.999Z'))).toBe(false);
    expect(freezePublicationPending(lockAt, 'no-archive', Date.parse('2026-10-21T09:40:00.001Z'))).toBe(false);
  });
  it('真實核實失敗或未知鎖點不能用等待掩蓋', () => {
    for (const code of ['not-verified', 'verification-failed', 'available', undefined]) {
      expect(freezePublicationPending(lockAt, code, Date.parse('2026-10-21T09:20:00Z'))).toBe(false);
    }
    expect(freezePublicationPending('invalid', 'no-archive')).toBe(false);
  });
});