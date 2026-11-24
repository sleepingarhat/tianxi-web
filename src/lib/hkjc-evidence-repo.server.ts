/** Append official raw evidence first; publish its manifest last with GitHub SHA concurrency checks. */
import {
  HKJC_EVIDENCE_CONTENTS_BASE,
  HKJC_EVIDENCE_PAGE_SIZE,
  paginateEvidenceRows,
  writeManifestWithConflictRetry,
  type EvidenceManifest,
  type EvidenceManifestEntry,
} from './hkjc-evidence-sync.functions';

export async function syncHkjcEvidenceToRepository() {
  const token = process.env['GITHUB_TOKEN'];
  if (!token) throw new Error('官方事件資料倉未設定授權');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const base = HKJC_EVIDENCE_CONTENTS_BASE;
  const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'tianxi-official-evidence' };
  const read = async (path: string) => {
    const r = await fetch(base + path, { headers, signal: AbortSignal.timeout(12_000) });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`資料倉讀取失敗 ${r.status}`);
    return await r.json() as { sha: string; content: string };
  };
  const encode = (text: string) => {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  };
  const decode = (text: string) => new TextDecoder().decode(Uint8Array.from(atob(text.replace(/\s/g, '')), c => c.charCodeAt(0)));
  const parseManifest = (text: string): EvidenceManifest => {
    const manifest = JSON.parse(text) as EvidenceManifest;
    if (!Array.isArray(manifest.snapshots)) throw new Error('官方事件清單格式不符');
    return manifest;
  };
  const write = async (path: string, text: string, sha?: string) => {
    const r = await fetch(base + path, { method: 'PUT', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'archive: official HKJC evidence (append-only)', content: encode(text), ...(sha ? { sha } : {}) }), signal: AbortSignal.timeout(15_000) });
    return r;
  };
  const writeOrThrow = async (path: string, text: string, sha?: string) => {
    const r = await write(path, text, sha);
    if (!r.ok) throw new Error(`官方事件同步失敗 ${r.status}，等待重試`);
  };
  const sha256Of = async (text: string) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  };

  type SnapshotRow = { race_date: string; source_url: string; sha256: string; source_sha256?:string; raw_html: string; venue?: string };

  type EvidenceTable = 'hkjc_changes_snapshots' | 'hkjc_cancellation_snapshots' | 'racing_dividend_snapshots';
  /** Sync one evidence table into one repo folder; one write per run, later runs resume from the manifest. */
  const syncTable = async (opts: { table: EvidenceTable; folder: string; select: string; name: (row: SnapshotRow) => string }) => {
    const rawRows = await paginateEvidenceRows(async (from, to) => {
      const { data, error } = await supabaseAdmin.from(opts.table)
        .select(opts.select).order('fetched_at').range(from, to);
      return { data: data as SnapshotRow[] | null, error };
    }, HKJC_EVIDENCE_PAGE_SIZE);
    const rows = rawRows.map(r=>({...r,sha256:r.sha256 ?? r.source_sha256 ?? ''}));
    const manifestPath = `data/${opts.folder}/manifest.json`;
    const current = await read(manifestPath);
    const manifest = current ? parseManifest(decode(current.content)) : { snapshots: [] as EvidenceManifestEntry[] };
    const known = new Set(manifest.snapshots.map(s => s.sha256));
    const pending: EvidenceManifestEntry[] = [];
    let added = 0;
    for (const row of rows.filter(r => !known.has(r.sha256)).slice(0, 1)) {
      const sha = await sha256Of(row.raw_html);
      if (sha !== row.sha256 || !/^https:\/\/racing\.hkjc\.com\//.test(row.source_url)) throw new Error('官方原文指紋或來源不符');
      const path = `data/${opts.folder}/${row.race_date}/${opts.name(row)}`;
      const existing = await read(path);
      if (existing && decode(existing.content) !== row.raw_html) throw new Error('資料倉已有原文不符，禁止覆寫');
      if (!existing) await writeOrThrow(path, row.raw_html);
      const entry: EvidenceManifestEntry = { path, sha256: sha, sourceUrl: row.source_url, date: row.race_date, kind: opts.folder };
      if (row.venue) entry.venue = row.venue;
      pending.push(entry);
      manifest.snapshots.push(entry);
      known.add(sha); added++;
    }
    if (added) {
      await writeManifestWithConflictRetry({
        initial: current ? { manifest, sha: current.sha } : { manifest },
        pending,
        read: async () => {
          const latest = await read(manifestPath);
          if (!latest) return null;
          return { sha: latest.sha, manifest: parseManifest(decode(latest.content)) };
        },
        write: async (text, sha) => {
          const r = await write(manifestPath, text, sha);
          return { ok: r.ok, status: r.status };
        },
      });
    }
    return { added, remaining: rows.filter(r => !known.has(r.sha256)).length };
  };

  const changes = await syncTable({
    table: 'hkjc_changes_snapshots', folder: 'racing-changes',
    select: 'race_date,venue,source_url,sha256,raw_html,fetched_at',
    name: (row) => `${row.venue}-${row.sha256}.html`,
  });
  const cancellations = await syncTable({
    table: 'hkjc_cancellation_snapshots', folder: 'racing-cancellations',
    select: 'race_date,source_url,sha256,raw_html,fetched_at',
    name: (row) => `cancellation-${row.sha256}.html`,
  });
  const dividends = await syncTable({
    table:'racing_dividend_snapshots',folder:'racing-dividends',
    select:'race_date,venue,source_url,source_sha256,raw_html,fetched_at',
    name:row=>`${row.venue}-${row.sha256}.html`,
  });
  return { ok: true, added: changes.added + cancellations.added + dividends.added, changes, cancellations, dividends };
}
