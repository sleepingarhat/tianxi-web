import { cached } from './computed-cache.server';
import { recordSummary, type RecordRollup } from './track-record-summary';
import { TX_BASE } from './tx-api';

export async function readTrackRecordSummary() {
  // Existing public-derived cache; no new KV binding or private racing rows exposed.
  return cached('track-record-summary:v1', 60 * 60_000, async () => {
    const rollups = await Promise.all([30, 60, 90, 180].map(async days => {
      const response = await fetch(`${TX_BASE}/api/analyze/hit-rate-rollup?days=${days}`, { signal: AbortSignal.timeout(12_000) });
      if (!response.ok) throw new Error('戰績摘要暫未能更新');
      return await response.json() as RecordRollup;
    }));
    return recordSummary(rollups);
  });
}