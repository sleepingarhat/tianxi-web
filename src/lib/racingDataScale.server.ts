// 數據規模索引：逐個賽果檔記低場數同賽果行數，每次只補新檔（最多 BATCH 個），避免超出 Worker 子請求上限。
const REPO = "sleepingarhat/tianxi-racing";
const BATCH = 40;
const PATH_RE = /^data\/\d{4}\/results_(\d{4}-\d{2}-\d{2})\.csv$/;

export function countResultsCsv(text: string): { races: number; rows: number } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const header = lines.shift() ?? "";
  const idx = header.split(",").indexOf("race_no");
  if (idx !== 2) throw new Error("賽果CSV缺少race_no表頭");
  const races = new Set<string>();
  let rows = 0;
  for (const l of lines) {
    if (!l.trim()) continue;
    const m = l.match(/^[^,]*,[^,]*,([^,]*)/); // race_no 係第 3 欄，前面兩欄冇引號
    if (!m) throw new Error("賽果CSV行不完整");
    rows++;
    const race = m[1];
    if (race && /^\d+$/.test(race)) races.add(race);
    else throw new Error("賽果CSV場次格式不完整");
  }
  return { races: races.size, rows };
}

export async function syncRacingDataScale() {
  const token = process.env["GITHUB_TOKEN"];
  const h: Record<string, string> = { "User-Agent": "tianxi-web", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tr = await fetch(`https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`, { headers: h });
  if (!tr.ok) return { ok: false, message: `GitHub ${tr.status}`, added: 0 };
  const payload = await tr.json() as { tree?: { path: string }[]; truncated?: boolean };
  if (payload.truncated || !Array.isArray(payload.tree)) return { ok: false, message: "GitHub檔案列表不完整", added: 0 };
  const tree = payload.tree;
  const paths = tree.map((t) => t.path).filter((p) => PATH_RE.test(p));
  const known = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const { data: have, error } = await supabaseAdmin.from("racing_results_index").select("path").order("path").range(offset, offset + 999);
    if (error || !have) return { ok: false, message: "現有索引未能完整讀取", added: 0 };
    have.forEach(row => known.add(row.path));
    if (have.length < 1000) break;
  }
  const failed: string[] = [];
  const todo = paths.filter((p) => !known.has(p)).sort().reverse().slice(0, BATCH);
  const rows = await Promise.all(todo.map(async (p) => {
    const r = await fetch(`https://raw.githubusercontent.com/${REPO}/main/${p}`, { headers: h });
    if (!r.ok) { failed.push(p); return null; }
    const match = PATH_RE.exec(p);
    if (!match?.[1]) { failed.push(p); return null; }
    try {
      const c = countResultsCsv(await r.text());
      if (!c.races || !c.rows) { failed.push(p); return null; }
      return { path: p, meeting_date: match[1], races: c.races, result_rows: c.rows };
    } catch { failed.push(p); return null; }
  }));
  const ok = rows.filter((r): r is NonNullable<typeof r> => !!r && r.races > 0);
  if (ok.length) {
    const { error } = await supabaseAdmin.from("racing_results_index").upsert(ok, { onConflict: "path" });
    if (error) return { ok: false, message: error.message, added: 0 };
  }
  const remaining = paths.filter(path => !known.has(path)).length - ok.length;
  return { ok: failed.length === 0 && remaining === 0, failed, message: failed.length ? `有${failed.length}個賽果檔未能索引，稍後重試` : remaining ? `索引進行中，尚餘${remaining}個賽果檔` : "索引完整", added: ok.length, remaining };
}
