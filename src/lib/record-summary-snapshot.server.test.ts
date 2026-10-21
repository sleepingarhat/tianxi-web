import { describe, expect, it } from 'vitest';
import { recordSummary } from './track-record-summary';
import { validateSummarySnapshot } from './record-summary-snapshot.server';
const complete = () => recordSummary([30, 60, 90, 180].map(windowDays => ({ windowDays, generatedAt: '2026-10-21T14:00:00Z', top4AvgIntersect: 1.99, racesEvaluated: 118, meetingsEvaluated: 12, perMeeting: [] })), '2026-10-21T14:01:00Z', { coverage: { rows: [], checkedAt: '2026-10-21T14:00:00Z' }, versions: { versions: [], truncated: false } });
describe('complete public summary publication', () => {
  it('preserves source averages and the fixed four-horse range', () => {
    expect(validateSummarySnapshot(complete()).summary['last90']).toMatchObject({ races: 118, avgHit: 1.99 });
  });
  it('rejects missing market windows', () => {
    const value = complete(); delete value.market?.['180'];
    expect(() => validateSummarySnapshot(value)).toThrow('未完整');
  });
  it('rejects missing version evidence', () => {
    const value = complete(); delete value.versions;
    expect(() => validateSummarySnapshot(value)).toThrow('未完整');
  });
  it('rejects changed source denominator', () => {
    const value = complete(); const row = value.summary['last90'];
    if (row) row.races = 119;
    expect(() => validateSummarySnapshot(value)).toThrow('未完整');
  });
});