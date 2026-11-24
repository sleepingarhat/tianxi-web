import { expect, it } from 'vitest';
import {
  HKJC_EVIDENCE_CONTENTS_BASE,
  HKJC_EVIDENCE_FAILURE_LEAD,
  HKJC_EVIDENCE_REPO,
  HKJC_EVIDENCE_SYNC_ALERT_KEY,
  formatHkjcEvidenceFailureAlert,
  formatHkjcEvidenceRecoveryAlert,
  mergeManifestSnapshots,
  paginateEvidenceRows,
  sanitizeAlertError,
  shouldSendDedupedFailureAlert,
  shouldSendRecoveryAlert,
  writeManifestWithConflictRetry,
  type EvidenceManifestEntry,
} from './hkjc-evidence-sync.functions';

const HOUR = 60 * 60_000;
const DEDUPE = 12 * HOUR;
const RECOVERY = 24 * HOUR;

it('writes official evidence to tianxi-racing, not the renamed tianxi-database URL', () => {
  expect(HKJC_EVIDENCE_REPO).toBe('sleepingarhat/tianxi-racing');
  expect(HKJC_EVIDENCE_CONTENTS_BASE).toBe('https://api.github.com/repos/sleepingarhat/tianxi-racing/contents/');
  expect(HKJC_EVIDENCE_CONTENTS_BASE).not.toContain('tianxi-database');
});

it('uses the existing telegram_alert_state key prefix', () => {
  expect(HKJC_EVIDENCE_SYNC_ALERT_KEY).toBe('alert:hkjc-evidence-sync');
});

it('keeps the training-guard lead-in and appends a sanitized cause on first failure', () => {
  const text = formatHkjcEvidenceFailureAlert(new Error('官方事件同步失敗 409，等待重試'));
  expect(text.startsWith(HKJC_EVIDENCE_FAILURE_LEAD)).toBe(true);
  expect(text).toContain('原因：官方事件同步失敗 409，等待重試');
  expect(text).toContain('訓練不得使用未核實清單');
});

it('redacts tokens and truncates alert errors', () => {
  const token = 'ghp_' + 'a'.repeat(36);
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaaa.bbbb';
  expect(sanitizeAlertError(`Bearer ${token} github_pat_abc123xyz failed`)).toBe('[redacted] [redacted] failed');
  expect(sanitizeAlertError(`status 401 ${jwt}`)).toBe('status 401 [redacted]');
  expect(sanitizeAlertError(new Error('sb_secret_supersecretvalue boom'))).toBe('[redacted] boom');
  const long = sanitizeAlertError('x'.repeat(400));
  expect(long.endsWith('…')).toBe(true);
  expect(long.length).toBe(241);
});

it('sends the first failure, then stays silent for the same unresolved failure inside 12 hours', () => {
  const now = Date.parse('2026-11-25T00:15:00+08:00');
  const fail = '官方事件同步失敗 409，等待重試';
  expect(shouldSendDedupedFailureAlert(null, fail, now, DEDUPE)).toBe(true);
  const prev = { value: { fail, sent_at: new Date(now).toISOString() } };
  expect(shouldSendDedupedFailureAlert(prev, fail, now + HOUR, DEDUPE)).toBe(false);
  expect(shouldSendDedupedFailureAlert(prev, fail, now + 11 * HOUR, DEDUPE)).toBe(false);
  expect(shouldSendDedupedFailureAlert(prev, fail, now + DEDUPE, DEDUPE)).toBe(true);
});

it('re-alerts when the failure cause changes, and recovers once after a success', () => {
  const now = Date.parse('2026-11-25T00:15:00+08:00');
  const prev = { value: { fail: '官方事件同步失敗 409，等待重試', sent_at: new Date(now).toISOString() } };
  expect(shouldSendDedupedFailureAlert(prev, '官方原文指紋或來源不符', now + HOUR, DEDUPE)).toBe(true);
  expect(shouldSendRecoveryAlert(prev, now + HOUR, RECOVERY)).toBe(true);
  expect(shouldSendRecoveryAlert({ value: { fail: null, sent_at: null } }, now + HOUR, RECOVERY)).toBe(false);
  expect(shouldSendRecoveryAlert(prev, now + 25 * HOUR, RECOVERY)).toBe(false);
  expect(formatHkjcEvidenceRecoveryAlert('官方事件同步失敗 409，等待重試')).toBe('✅ 已恢復 馬會更易原文同步資料倉（之前：官方事件同步失敗 409，等待重試）');
});

it('paginates past 2000 rows instead of hard-failing the job', async () => {
  const pages: Array<[number, number]> = [];
  const rows = await paginateEvidenceRows(async (from, to) => {
    pages.push([from, to]);
    if (from === 0) return { data: Array.from({ length: 1000 }, (_, i) => i), error: null };
    if (from === 1000) return { data: Array.from({ length: 1000 }, (_, i) => i + 1000), error: null };
    return { data: Array.from({ length: 50 }, (_, i) => i + 2000), error: null };
  }, 1000);
  expect(rows).toHaveLength(2050);
  expect(pages).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
});

it('still stops if a page cannot be read completely', async () => {
  await expect(paginateEvidenceRows(async () => ({ data: null, error: { message: 'boom' } }))).rejects.toThrow('官方事件未能完整讀取，停止同步');
});

it('merges pending snapshots without rewriting or dropping already published ones', () => {
  const published: EvidenceManifestEntry = {
    path: 'data/racing-changes/2026-11-25/HV-aaa.html',
    sha256: 'aaa',
    sourceUrl: 'https://racing.hkjc.com/zh-hk/local/information/changes',
    date: '2026-11-25',
    kind: 'racing-changes',
    venue: 'HV',
  };
  const pending: EvidenceManifestEntry = {
    path: 'data/racing-changes/2026-11-25/HV-bbb.html',
    sha256: 'bbb',
    sourceUrl: 'https://racing.hkjc.com/zh-hk/local/information/changes',
    date: '2026-11-25',
    kind: 'racing-changes',
    venue: 'HV',
  };
  const merged = mergeManifestSnapshots({ snapshots: [published] }, [published, pending]);
  expect(merged.snapshots).toEqual([published, pending]);
});

it('re-reads the manifest on 409 and retries with the fresh SHA instead of hard-failing', async () => {
  const pending: EvidenceManifestEntry = {
    path: 'data/racing-changes/2026-11-25/HV-bbb.html',
    sha256: 'bbb',
    sourceUrl: 'https://racing.hkjc.com/zh-hk/local/information/changes',
    date: '2026-11-25',
    kind: 'racing-changes',
    venue: 'HV',
  };
  const initial = {
    sha: 'sha-old',
    manifest: { snapshots: [{ ...pending, sha256: 'aaa', path: 'data/racing-changes/2026-11-25/HV-aaa.html' }] },
  };
  const writes: Array<{ sha?: string; text: string }> = [];
  await writeManifestWithConflictRetry({
    initial,
    pending: [pending],
    read: async () => ({
      sha: 'sha-new',
      manifest: {
        snapshots: [
          { ...pending, sha256: 'aaa', path: 'data/racing-changes/2026-11-25/HV-aaa.html' },
          { ...pending, sha256: 'ccc', path: 'data/racing-changes/2026-11-25/HV-ccc.html' },
        ],
      },
    }),
    write: async (text, sha) => {
      writes.push({ sha, text });
      return writes.length === 1 ? { ok: false, status: 409 } : { ok: true, status: 200 };
    },
  });
  expect(writes).toHaveLength(2);
  expect(writes[0]?.sha).toBe('sha-old');
  expect(writes[1]?.sha).toBe('sha-new');
  const retried = JSON.parse(writes[1]!.text) as { snapshots: { sha256: string }[] };
  expect(retried.snapshots.map((s) => s.sha256)).toEqual(['aaa', 'ccc', 'bbb']);
});
