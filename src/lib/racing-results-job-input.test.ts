import { describe, expect, it } from 'vitest';
import { racingResultsJobInput } from './racing-results-job-input';

describe('official archive backfill input', () => {
  it('accepts the requested 19 October races 10 and 11', () => {
    for (const raceNumber of [10, 11]) {
      expect(racingResultsJobInput.parse({ kind: 'archive-backfill', date: '2026-10-19', venue: 'ST', raceNumber }).kind).toBe('archive-backfill');
    }
  });
  it('rejects invalid dates and unknown input fields', () => {
    expect(racingResultsJobInput.safeParse({ kind: 'archive-backfill', date: '2026-02-30', venue: 'ST', raceNumber: 10 }).success).toBe(false);
    expect(racingResultsJobInput.safeParse({ kind: 'archive-backfill', date: '2026-10-19', venue: 'ST', raceNumber: 10, recompute: true }).success).toBe(false);
  });
});