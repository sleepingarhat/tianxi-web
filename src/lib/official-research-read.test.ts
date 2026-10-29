import { expect, it } from 'vitest';
import { requireOfficialRead } from './official-research-read';
it('all unavailable sections fail so retries remain possible', () => {
  expect(() => requireOfficialRead({ rating: { rows: [], available: false }, movement: { rows: [], available: false } })).toThrow('暫未能讀取');
});
it('preserves genuinely empty records and independently unavailable sections', () => {
  const result = { rating: { rows: [], available: true }, movement: { rows: [], available: false } };
  expect(requireOfficialRead(result)).toBe(result);
});