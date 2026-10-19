/** Append official raw evidence first; publish its manifest last with GitHub SHA concurrency checks. */
export async function syncHkjcEvidenceToRepository() {
  const token = process.env['GITHUB_TOKEN'];
  if (!token) throw new Error('官方事件資料倉未設定授權');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.from('hkjc_changes_snapshots')
    .select('race_date,venue,source_url,sha256,raw_html,fetched_at').order('fetched_at').limit(2001);
  if (error || !data || data.length > 2000) throw new Error('官方事件未能完整讀取，停止同步');
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
  const manifestPath = 'data/racing-changes/manifest.json';
  const current = await read(manifestPath);
  const manifest = current ? JSON.parse(decode(current.content)) as { snapshots: { path: string; sha256: string; sourceUrl: string; date?: string; venue?: string }[] } : { snapshots: [] };
  if (!Array.isArray(manifest.snapshots)) throw new Error('官方事件清單格式不符');
  const known = new Set(manifest.snapshots.map(s => s.sha256));
  const write = async (path: string, text: string, sha?: string) => {
    const r = await fetch(base + path, { method: 'PUT', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'archive: official HKJC evidence (append-only)', content: encode(text), ...(sha ? { sha } : {}) }), signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`官方事件同步失敗 ${r.status}，等待重試`);
  };
  let added = 0;
  // Bound writes per callback; later hourly runs resume from the published manifest.
  for (const row of data.filter(r => !known.has(r.sha256)).slice(0, 1)) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(row.raw_html));
    const sha = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    if (sha !== row.sha256 || !/^https:\/\/racing\.hkjc\.com\//.test(row.source_url)) throw new Error('官方原文指紋或來源不符');
    const path = `data/racing-changes/${row.race_date}/${row.venue}-${sha}.html`;
    const existing = await read(path);
    if (existing && decode(existing.content) !== row.raw_html) throw new Error('資料倉已有原文不符，禁止覆寫');
    if (!existing) await write(path, row.raw_html);
    manifest.snapshots.push({ path, sha256: sha, sourceUrl: row.source_url, date: row.race_date, venue: row.venue });
    known.add(sha); added++;
  }
  if (added) await write(manifestPath, JSON.stringify(manifest, null, 2), current?.sha);
  return { ok: true, added, remaining: data.filter(r => !known.has(r.sha256)).length };
}