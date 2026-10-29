import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ read: vi.fn(), key: vi.fn() }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { from: () => ({ select: () => ({ eq: (...args: unknown[]) => { mocks.key(...args); return { maybeSingle: mocks.read }; } }) }) } }));
import { readStoredCoverageAudit } from './coverage-snapshot.server';
const complete = { rows: [], meetings: [], failed: [], missingOdds: [], checkedAt: '2026-10-28T23:07:22Z' };
beforeEach(() => { vi.clearAllMocks(); mocks.read.mockResolvedValue({ data: { payload: complete }, error: null }); });
it('reads the dated complete 180-day snapshot without visitor upstream work', async () => {
  const upstream = vi.spyOn(globalThis, 'fetch');
  expect(await readStoredCoverageAudit(180)).toEqual(complete);
  expect(mocks.key).toHaveBeenCalledWith('key', 'coverage:original-v5:180');
  expect(upstream).not.toHaveBeenCalled(); upstream.mockRestore();
});
it('rejects missing or partial snapshots rather than returning empty success', async () => {
  for (const payload of [null, { ...complete, failed: ['2026-10-28'] }, { ...complete, missingOdds: ['2026-10-28'] }, { ...complete, checkedAt: 'invalid' }]) {
    mocks.read.mockResolvedValueOnce({ data: { payload }, error: null });
    await expect(readStoredCoverageAudit(180)).rejects.toThrow('完整紀錄');
  }
});