/** Append official raw evidence first; publish its manifest last with GitHub SHA concurrency checks. */
import {
  EVIDENCE_METADATA_SELECT,
  HKJC_EVIDENCE_CONTENTS_BASE,
  HKJC_EVIDENCE_PAGE_SIZE,
  evidenceRawHtmlFilters,
  evidenceReadFailure,
  paginateEvidenceRows,
  writeManifestWithConflictRetry,
  type EvidenceColumnFilter,
  type EvidenceManifest,
  type EvidenceManifestEntry,
  type EvidenceTableName,
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

  type MetaRow = { race_date: string; source_url: string; sha256?: string; source_sha256?: string; venue?: string };
  type SnapshotMeta = { race_date: string; source_url: string; sha256: string; source_sha256?: string; venue?: string };
  type RawPage = { data: { raw_html: string }[] | null; error: unknown };

  const filterValue = (filters: EvidenceColumnFilter[], column: EvidenceColumnFilter['column']) => {
    const found = filters.find((filter) => filter.column === column);
    if (!found) throw evidenceReadFailure(null);
    return found.value;
  };
  /** One row, raw_html only. The metadata pass has already decided this original is pending. */
  const readPendingRawHtml = async (table: EvidenceTableName, row: SnapshotMeta): Promise<string> => {
    const filters = evidenceRawHtmlFilters(table, row);
    const raceDate = filterValue(filters, 'race_date');
    let page: RawPage;
    if (table === 'racing_dividend_snapshots') {
      page = await supabaseAdmin.from(table).select('raw_html').eq('race_date', raceDate).eq('venue', filterValue(filters, 'venue')).eq('source_sha256', filterValue(filters, 'source_sha256')).limit(2);
    } else if (table === 'hkjc_changes_snapshots') {
      page = await supabaseAdmin.from(table).select('raw_html').eq('race_date', raceDate).eq('venue', filterValue(filters, 'venue')).eq('sha256', filterValue(filters, 'sha256')).limit(2);
    } else {
      page = await supabaseAdmin.from(table).select('raw_html').eq('race_date', raceDate).eq('source_url', filterValue(filters, 'source_url')).eq('sha256', filterValue(filters, 'sha256')).limit(2);
    }
    if (page.error || page.data == null || page.data.length !== 1) throw evidenceReadFailure(page.error);
    const html = page.data[0]?.raw_html;
    if (typeof html !== 'string') throw evidenceReadFailure(page.error);
    return html;
  };
  const readMetadataPage = async (table: EvidenceTableName, from: number, to: number) => {
    if (table === 'hkjc_changes_snapshots') {
      return supabaseAdmin.from(table).select(EVIDENCE_METADATA_SELECT[table]).order('fetched_at').range(from, to);
    }
    if (table === 'hkjc_cancellation_snapshots') {
      return supabaseAdmin.from(table).select(EVIDENCE_METADATA_SELECT[table]).order('fetched_at').range(from, to);
    }
    return supabaseAdmin.from(table).select(EVIDENCE_METADATA_SELECT[table]).order('fetched_at').range(from, to);
  };

  /** Sync one evidence table into one repo folder; one write per run, later runs resume from the manifest.
   * Metadata pages omit raw_html. The body is loaded only for the single pending row this run archives. */
  const syncTable = async (opts: { table: EvidenceTableName; folder: string; name: (row: SnapshotMeta) => string }) => {
    const rawRows = await paginateEvidenceRows(async (from, to) => {
      const page = await readMetadataPage(opts.table, from, to);
      return { data: page.data as MetaRow[] | null, error: page.error };
    }, HKJC_EVIDENCE_PAGE_SIZE);
    const rows = rawRows.map((r) => {
      const row: SnapshotMeta = { race_date: r.race_date, source_url: r.source_url, sha256: r.sha256 ?? r.source_sha256 ?? '' };
      if (r.venue) row.venue = r.venue;
      if (r.source_sha256) row.source_sha256 = r.source_sha256;
      return row;
    });
    const manifestPath = `data/${opts.folder}/manifest.json`;
    const current = await read(manifestPath);
    const manifest = current ? parseManifest(decode(current.content)) : { snapshots: [] as EvidenceManifestEntry[] };
    const known = new Set(manifest.snapshots.map(s => s.sha256));
    const pending: EvidenceManifestEntry[] = [];
    let added = 0;
    for (const row of rows.filter(r => !known.has(r.sha256)).slice(0, 1)) {
      const rawHtml = await readPendingRawHtml(opts.table, row);
      const sha = await sha256Of(rawHtml);
      if (sha !== row.sha256 || !/^https:\/\/racing\.hkjc\.com\//.test(row.source_url)) throw new Error('官方原文指紋或來源不符');
      const path = `data/${opts.folder}/${row.race_date}/${opts.name(row)}`;
      const existing = await read(path);
      if (existing && decode(existing.content) !== rawHtml) throw new Error('資料倉已有原文不符，禁止覆寫');
      if (!existing) await writeOrThrow(path, rawHtml);
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
    name: (row) => `${row.venue}-${row.sha256}.html`,
  });
  const cancellations = await syncTable({
    table: 'hkjc_cancellation_snapshots', folder: 'racing-cancellations',
    name: (row) => `cancellation-${row.sha256}.html`,
  });
  const dividends = await syncTable({
    table:'racing_dividend_snapshots',folder:'racing-dividends',
    name:row=>`${row.venue}-${row.sha256}.html`,
  });
  return { ok: true, added: changes.added + cancellations.added + dividends.added, changes, cancellations, dividends };
}
