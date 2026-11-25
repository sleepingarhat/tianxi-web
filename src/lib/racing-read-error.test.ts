import { describe, expect, it } from 'vitest';
import { FrozenEvidenceError } from './frozen-racing';
import { isRacingThrottle, presentRacingReadError, racingReadFailureMessage, racingThrottleDelayMs, RACING_BUSY_MESSAGE, RACING_READ_FAILED_MESSAGE } from './racing-read-error';

const GATEWAY = '{"success":false,"errors":[{"code":971,"message":"Please wait and consider throttling your request speed"}],"messages":[],"result":null}';

describe('賽日讀取錯誤唔暴露閘道內容', () => {
  it('429、503 同 971 當短暫限流', () => {
    expect(isRacingThrottle(429, '')).toBe(true);
    expect(isRacingThrottle(503, 'upstream unavailable')).toBe(true);
    expect(isRacingThrottle(200, GATEWAY)).toBe(true);
    expect(isRacingThrottle(400, '{"error":"bad sql"}')).toBe(false);
  });
  it('用戶訊息唔包含狀態碼或 JSON', () => {
    expect(racingReadFailureMessage(429, GATEWAY)).toBe(RACING_BUSY_MESSAGE);
    expect(racingReadFailureMessage(400, '{"error":"bad sql"}')).toBe(RACING_READ_FAILED_MESSAGE);
    expect(racingReadFailureMessage(429, GATEWAY)).not.toContain('971');
    expect(racingReadFailureMessage(400, '{"error":"bad sql"}')).not.toContain('{');
  });
  it('退避有抖動而且有上限', () => {
    expect(racingThrottleDelayMs(0, null, () => 0)).toBe(400);
    expect(racingThrottleDelayMs(1, null, () => 0)).toBe(800);
    expect(racingThrottleDelayMs(0, '1', () => 0)).toBe(1_000);
    expect(racingThrottleDelayMs(0, '30', () => 0)).toBe(2_500);
    expect(racingThrottleDelayMs(4, null, () => 1)).toBe(2_500);
    expect(racingThrottleDelayMs(0, 'Wed, 21 Oct 2026 00:00:00 GMT', () => 0)).toBe(400);
  });
  it('已核實失敗保持原訊息，閘道 JSON 改成繁忙', () => {
    const evidence = new FrozenEvidenceError('verification-failed', '原始副本指紋不一致');
    expect(presentRacingReadError(evidence)).toBe(evidence);
    expect(presentRacingReadError(new Error('鎖定狀態暫未能核實')).message).toBe('鎖定狀態暫未能核實');
    const leaked = presentRacingReadError(new Error(`賽馬核對資料讀取失敗 [429]: ${GATEWAY}`));
    expect(leaked.message).toBe(RACING_BUSY_MESSAGE);
    expect(leaked.message).not.toContain('971');
    expect(presentRacingReadError({ message: GATEWAY }).message).toBe(RACING_BUSY_MESSAGE);
  });
});
