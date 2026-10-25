import { recordSummary, type RecordRollup } from './track-record-summary';
import { TX_BASE } from './tx-api';
import { workerFetch } from './site-reader.server';
import { readCoverageAudit } from './coverage-audit.server';
import { readVersionHistory } from './version-history.server';
import type { RecordSummary } from './track-record-summary';
import { publishSummary, readPublishedSummary } from './record-summary-snapshot.server';

let memory: { value: RecordSummary; until: number } | undefined;
let reading: Promise<RecordSummary> | undefined;
let refreshing: Promise<RecordSummary> | undefined;

export async function readTrackRecordSummary(force = false): Promise<RecordSummary> {
  if (!force) {
    if (memory && memory.until > Date.now()) return memory.value;
    if (reading) return reading;
    reading = readPublishedSummary().then(value => {
      // A refresh that completed during this read must not be overwritten by the older response.
      if (!memory || Date.parse(value.generatedAt) >= Date.parse(memory.value.generatedAt)) memory = { value, until: Date.now() + 60_000 };
      return memory.value;
    }).finally(() => { reading = undefined; });
    return reading;
  }
  if (refreshing) return refreshing;
  refreshing = (async () => {
    // Five concurrent calls, then at most six during coverage: respect the edge connection limit.
    const [rollups, versions] = await Promise.all([Promise.all([30, 60, 90, 180].map(async days => {
      const response = await workerFetch(`${TX_BASE}/api/analyze/hit-rate-rollup?days=${days}`, { signal: AbortSignal.timeout(12_000) });
      if (!response.ok) throw new Error('戰績摘要暫未能更新');
      return await response.json() as RecordRollup;
    })), readVersionHistory()]);
    const coverage = await readCoverageAudit(180, true);
    const value = await publishSummary(recordSummary(rollups, new Date().toISOString(), { coverage, versions }));
    memory = { value, until: Date.now() + 60_000 };
    return value;
  })().finally(() => { refreshing = undefined; });
  return refreshing;
}