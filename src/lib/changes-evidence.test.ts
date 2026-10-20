import { describe, expect, it } from 'vitest';
import { readChangesEvidence, changesAwareStatus, staleCheckOutcome } from './changes-evidence';
import { officialRaceMetric } from './racing-official-metrics';

describe('馬會更改讀取失敗不可當成冇更改', () => {
  it('讀取失敗回報ok=false，唔會變空清單', async () => {
    expect(await readChangesEvidence(async () => { throw new Error('down'); })).toEqual({ ok: false });
    expect(await readChangesEvidence(async () => null)).toEqual({ ok: true, snapshot: null });
  });
  it('讀取失敗嘅場次不入正式命中分母', () => {
    const status = changesAwareStatus(false, 'valid');
    expect(officialRaceMetric({ original: [1,2,3,4], actualTop4: [1,2,3,4], status, hasWithdrawal: false, postLockJockeyChange: false }).eligible).toBe(false);
    expect(changesAwareStatus(true, 'valid')).toBe('valid');
  });
  it('預測讀唔到時係未知，唔係已剔除', () => {
    expect(staleCheckOutcome(null, [])).toBe('unknown');
    expect(staleCheckOutcome({}, [])).toBe('clean');
    expect(staleCheckOutcome({}, ['R1 #3'])).toBe('stale');
  });
});
