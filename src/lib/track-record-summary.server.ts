import { cached } from './computed-cache.server';
import { recordSummary, type RecordRollup } from './track-record-summary';
import { TX_BASE } from './tx-api';
import { readCoverageAudit } from './coverage-audit.server';
import { readVersionHistory } from './version-history.server';
import type { RecordSummary } from './track-record-summary';

let memory: { value: RecordSummary; until: number } | undefined;
let inflight: Promise<RecordSummary> | undefined;

export async function readTrackRecordSummary(force = false): Promise<RecordSummary> {
  if (!force && memory && memory.until > Date.now()) return memory.value;
  if (inflight) return inflight;
  // Existing public-derived cache; no new KV binding or private racing rows exposed.
  inflight = cached('track-record-summary:v2', force ? 0 : 60 * 60_000, async () => {
    const extras = Promise.allSettled([readCoverageAudit(180), readVersionHistory()]);
    const rollups = await Promise.all([30, 60, 90, 180].map(async days => {
      const response = await fetch(`${TX_BASE}/api/analyze/hit-rate-rollup?days=${days}`, { signal: AbortSignal.timeout(12_000) });
      if (!response.ok) throw new Error('戰績摘要暫未能更新');
      return await response.json() as RecordRollup;
    }));
    const [coverage, versions] = await extras;
    return recordSummary(rollups, new Date().toISOString(), {
      ...(coverage.status === 'fulfilled' ? { coverage: coverage.value } : {}),
      ...(versions.status === 'fulfilled' ? { versions: versions.value } : {}),
    });
  }).then(value => { memory = { value, until: Date.now() + 60_000 }; return value; }).finally(() => { inflight = undefined; });
  return inflight;
}