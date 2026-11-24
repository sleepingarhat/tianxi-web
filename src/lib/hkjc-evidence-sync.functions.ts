/** Pure helpers for official HKJC evidence warehouse sync and its Telegram alerts. */
export const HKJC_EVIDENCE_REPO = 'sleepingarhat/tianxi-racing';
export const HKJC_EVIDENCE_CONTENTS_BASE = `https://api.github.com/repos/${HKJC_EVIDENCE_REPO}/contents/`;
export const HKJC_EVIDENCE_SYNC_ALERT_KEY = 'alert:hkjc-evidence-sync';
export const HKJC_EVIDENCE_PAGE_SIZE = 1000;
export const HKJC_EVIDENCE_MANIFEST_RETRY_ATTEMPTS = 3;
export const HKJC_EVIDENCE_FAILURE_LEAD = '⚠️ 馬會更易原文同步資料倉失敗；原文仍保留，下一次安全重試，訓練不得使用未核實清單。';

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

export async function paginateEvidenceRows<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
  pageSize = HKJC_EVIDENCE_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error || !data) throw new Error('官方事件未能完整讀取，停止同步');
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
