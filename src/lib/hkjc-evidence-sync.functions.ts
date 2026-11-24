/** Pure helpers for official HKJC evidence warehouse sync and its Telegram alerts. */
export const HKJC_EVIDENCE_REPO = 'sleepingarhat/tianxi-racing';
export const HKJC_EVIDENCE_CONTENTS_BASE = `https://api.github.com/repos/${HKJC_EVIDENCE_REPO}/contents/`;
export const HKJC_EVIDENCE_SYNC_ALERT_KEY = 'alert:hkjc-evidence-sync';
export const HKJC_EVIDENCE_PAGE_SIZE = 1000;
export const HKJC_EVIDENCE_MANIFEST_RETRY_ATTEMPTS = 3;
export const HKJC_EVIDENCE_FAILURE_LEAD = '⚠️ 馬會更易原文同步資料倉失敗；原文仍保留，下一次安全重試，訓練不得使用未核實清單。';
export const HKJC_EVIDENCE_READ_FAILURE = '官方事件未能完整讀取，停止同步';

export type EvidenceTableName =
  | 'hkjc_changes_snapshots'
  | 'hkjc_cancellation_snapshots'
  | 'racing_dividend_snapshots';

/** Columns needed to diff a table against the warehouse manifest. Bodies stay out of this read. */
export const EVIDENCE_METADATA_SELECT = {
  hkjc_changes_snapshots: 'race_date,venue,source_url,sha256,fetched_at',
  hkjc_cancellation_snapshots: 'race_date,source_url,sha256,fetched_at',
  racing_dividend_snapshots: 'race_date,venue,source_url,source_sha256,fetched_at',
} as const satisfies Record<EvidenceTableName, string>;

export type EvidenceIdentity = {
  race_date: string;
  source_url: string;
  sha256: string;
  venue?: string;
};

export type EvidenceColumnFilter = {
  column: 'race_date' | 'venue' | 'source_url' | 'sha256' | 'source_sha256';
  value: string;
};

const SECRET_PATTERNS = [
  /\bBearer\s+\S+/gi,
  /\bghp_[A-Za-z0-9_]+/g,
  /\bgithub_pat_[A-Za-z0-9_]+/g,
  /\bgho_[A-Za-z0-9_]+/g,
  /\bghu_[A-Za-z0-9_]+/g,
  /\bsk-[A-Za-z0-9]+/g,
  /\bsb_(?:publishable|secret)_\S+/gi,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /\bxox[baprs]-[A-Za-z0-9-]+/g,
  /\bAKIA[0-9A-Z]{16}/g,
];

export function sanitizeAlertError(error: unknown, maxLen = 240): string {
  let text = '';
  if (error instanceof Error) text = error.message;
  else if (typeof error === 'string') text = error;
  else {
    try { text = JSON.stringify(error) ?? ''; }
    catch { text = String(error); }
  }
  for (const re of SECRET_PATTERNS) text = text.replace(re, '[redacted]');
  text = text.replace(/\s+/g, ' ').trim();
  if (!text) text = '未知錯誤';
  if (text.length > maxLen) text = `${text.slice(0, maxLen)}…`;
  return text;
}

export function formatHkjcEvidenceFailureAlert(error: unknown): string {
  return `${HKJC_EVIDENCE_FAILURE_LEAD}\n原因：${sanitizeAlertError(error)}`;
}

export function formatHkjcEvidenceRecoveryAlert(previousFail: string): string {
  return `✅ 已恢復 馬會更易原文同步資料倉（之前：${sanitizeAlertError(previousFail)}）`;
}

export type AlertStateValue = { sent_at?: string | null; fail?: string | null };

export function shouldSendDedupedFailureAlert(
  prev: { value?: AlertStateValue } | null | undefined,
  fail: string,
  now = Date.now(),
  dedupeMs = 12 * 60 * 60_000,
): boolean {
  if (!prev?.value?.sent_at) return true;
  const lastSent = Date.parse(prev.value.sent_at);
  if (!Number.isFinite(lastSent)) return true;
  if (prev.value.fail && prev.value.fail !== fail) return true;
  return now - lastSent >= dedupeMs;
}

export function shouldSendRecoveryAlert(
  prev: { value?: AlertStateValue } | null | undefined,
  now = Date.now(),
  recoveryMs = 24 * 60 * 60_000,
): boolean {
  const lastFail = prev?.value?.fail;
  const sentAt = prev?.value?.sent_at;
  if (!lastFail || !sentAt) return false;
  const lastSent = Date.parse(sentAt);
  return Number.isFinite(lastSent) && now - lastSent <= recoveryMs;
}

export type EvidenceManifestEntry = {
  path: string;
  sha256: string;
  sourceUrl: string;
  date: string;
  kind: string;
  venue?: string;
};
export type EvidenceManifest = { snapshots: EvidenceManifestEntry[] };

export function mergeManifestSnapshots(current: EvidenceManifest, pending: EvidenceManifestEntry[]): EvidenceManifest {
  if (!Array.isArray(current.snapshots)) throw new Error('官方事件清單格式不符');
  const known = new Set(current.snapshots.map((s) => s.sha256));
  const snapshots = [...current.snapshots];
  for (const entry of pending) {
    if (!known.has(entry.sha256)) {
      snapshots.push(entry);
      known.add(entry.sha256);
    }
  }
  return { snapshots };
}

function readErrorField(error: unknown, key: 'message' | 'code'): string {
  if (!error || typeof error !== 'object') return '';
  const value = (error as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** PostgREST `error.message` and `error.code` with tokens removed. Empty when neither field is present. */
export function sanitizeSupabaseReadError(error: unknown): string {
  const code = readErrorField(error, 'code');
  const message = readErrorField(error, 'message');
  const parts: string[] = [];
  if (code) parts.push(`code=${sanitizeAlertError(code, 32)}`);
  if (message) parts.push(`message=${sanitizeAlertError(message, 160)}`);
  return parts.join(' ');
}

export function evidenceReadFailure(error: unknown): Error {
  const detail = sanitizeSupabaseReadError(error);
  return new Error(detail ? `${HKJC_EVIDENCE_READ_FAILURE}（${detail}）` : HKJC_EVIDENCE_READ_FAILURE);
}

/** Identity of the one original whose raw_html this run may archive. Missing keys stop the read. */
export function evidenceRawHtmlFilters(table: EvidenceTableName, row: EvidenceIdentity): EvidenceColumnFilter[] {
  if (!row.race_date || !row.sha256) throw evidenceReadFailure(null);
  if (table === 'hkjc_cancellation_snapshots') {
    if (!row.source_url) throw evidenceReadFailure(null);
    return [
      { column: 'race_date', value: row.race_date },
      { column: 'source_url', value: row.source_url },
      { column: 'sha256', value: row.sha256 },
    ];
  }
  if (!row.venue) throw evidenceReadFailure(null);
  if (table === 'racing_dividend_snapshots') {
    return [
      { column: 'race_date', value: row.race_date },
      { column: 'venue', value: row.venue },
      { column: 'source_sha256', value: row.sha256 },
    ];
  }
  return [
    { column: 'race_date', value: row.race_date },
    { column: 'venue', value: row.venue },
    { column: 'sha256', value: row.sha256 },
  ];
}

export async function paginateEvidenceRows<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
  pageSize = HKJC_EVIDENCE_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error || data == null) throw evidenceReadFailure(error);
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

export async function writeManifestWithConflictRetry(opts: {
  read: () => Promise<{ sha: string; manifest: EvidenceManifest } | null>;
  write: (text: string, sha?: string) => Promise<{ ok: boolean; status: number }>;
  pending: EvidenceManifestEntry[];
  initial: { manifest: EvidenceManifest; sha?: string };
  maxAttempts?: number;
}): Promise<void> {
  const maxAttempts = opts.maxAttempts ?? HKJC_EVIDENCE_MANIFEST_RETRY_ATTEMPTS;
  let manifest = opts.initial.manifest;
  let sha = opts.initial.sha;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await opts.write(JSON.stringify(manifest, null, 2), sha);
    if (result.ok) return;
    if (result.status !== 409 || attempt === maxAttempts) {
      throw new Error(`官方事件同步失敗 ${result.status}，等待重試`);
    }
    const latest = await opts.read();
    if (!latest) throw new Error('官方事件清單讀取失敗，等待重試');
    manifest = mergeManifestSnapshots(latest.manifest, opts.pending);
    sha = latest.sha;
  }
}
