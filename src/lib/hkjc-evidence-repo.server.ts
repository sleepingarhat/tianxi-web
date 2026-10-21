/** Append official raw evidence first; publish its manifest last with GitHub SHA concurrency checks. */
export async function syncHkjcEvidenceToRepository() {
  const token = process.env['GITHUB_TOKEN'];
  if (!token) throw new Error('官方事件資料倉未設定授權');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const base = 'https://api.github.com/repos/sleepingarhat/tianxi-database/contents/';
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
  const write = async (path: string, text: string, sha?: string) => {
    const r = await fetch(base + path, { method: 'PUT', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'archive: official HKJC evidence (append-only)', content: encode(text), ...(sha ? { sha } : {}) }), signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`官方事件同步失敗 ${r.status}，等待重試`);
  };
  const sha256Of = async (text: string) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  };

  type SnapshotRow = { race_date: string; source_url: string; sha256: string; source_sha256?:string; raw_html: string; venue?: string };
  type ManifestEntry = { path: string; sha256: string; sourceUrl: string; date: string; kind: string; venue?: string };
  type Manifest = { snapshots: ManifestEntry[] };

  type EvidenceTable = 'hkjc_changes_snapshots' | 'hkjc_cancellation_snapshots' | 'racing_dividend_snapshots';
  /** Sync one evidence table into one repo folder; one write per run, later runs resume from the manifest. */
  const syncTable = async (opts: { table: EvidenceTable; folder: string; select: string; name: (row: SnapshotRow) => string }) => {
    const { data, error } = await supabaseAdmin.from(opts.table)
      .select(opts.select).order('fetched_at').limit(2001);
    if (error || !data || data.length > 2000) throw new Error('官方事件未能完整讀取，停止同步');
    const rows = (data as unknown as SnapshotRow[]).map(r=>({...r,sha256:r.sha256 ?? r.source_sha256 ?? ''}));
    const manifestPath = `data/${opts.folder}/manifest.json`;
    const current = await read(manifestPath);
    const manifest = current ? JSON.parse(decode(current.content)) as Manifest : { snapshots: [] };
    if (!Array.isArray(manifest.snapshots)) throw new Error('官方事件清單格式不符');
    const known = new Set(manifest.snapshots.map(s => s.sha256));
    let added = 0;
    for (const row of rows.filter(r => !known.has(r.sha256)).slice(0, 1)) {
      const sha = await sha256Of(row.raw_html);
      if (sha !== row.sha256 || !/^https:\/\/racing\.hkjc\.com\//.test(row.source_url)) throw new Error('官方原文指紋或來源不符');
      const path = `data/${opts.folder}/${row.race_date}/${opts.name(row)}`;
      const existing = await read(path);
      if (existing && decode(existing.content) !== row.raw_html) throw new Error('資料倉已有原文不符，禁止覆寫');
      if (!existing) await write(path, row.raw_html);
      const entry: ManifestEntry = { path, sha256: sha, sourceUrl: row.source_url, date: row.race_date, kind: opts.folder };
      if (row.venue) entry.venue = row.venue;
      manifest.snapshots.push(entry);
      known.add(sha); added++;
    }
    if (added) await write(manifestPath, JSON.stringify(manifest, null, 2), current?.sha);
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