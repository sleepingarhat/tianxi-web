// 官方派彩（每 $10 一注）：直接讀 tianxi-racing 倉每日派彩檔 data/YYYY/dividends_DATE.csv
export type DividendRow = { race_no: number; pool: string; combo: string; dividend: number; unit: number; declared_dividend?: number; declared_unit?: number };

/**
 * Official amount → payout per $10. HKJC declares some dividends to a partial
 * unit ("235,071.20/$1.0" = each $1 receives $235,071.20); the per-$10 figure
 * is the declared amount × 10 / unit. Anything else (refund text, blanks) is
 * null so callers keep failing closed.
 */
export function normalizeOfficialDividend(text: string): { dividend: number; declared_dividend: number; declared_unit: number } | null {
  const m = /^(\d+(?:\.\d+)?)(?:\/\$(\d+(?:\.\d+)?))?$/.exec(String(text ?? '').replaceAll(',', '').trim());
  if (!m) return null;
  const declared = Number(m[1]), unit = m[2] === undefined ? 10 : Number(m[2]);
  if (!Number.isFinite(declared) || !Number.isFinite(unit) || unit <= 0 || unit > 10) return null;
  return { dividend: Math.round(declared * 10 / unit * 100) / 100, declared_dividend: declared, declared_unit: unit };
}

export async function fetchRaceDividendEvidence(date: string, venue?: string): Promise<{ rows: DividendRow[]; trios: Record<number,string>; source?: {url:string;sha256:string} }> {
  const response = await fetch(`/api/public/racing-dividends?date=${encodeURIComponent(date)}`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error('官方派彩存證暫未能讀取');
  const { evidence } = await response.json();
  if (evidence) {
    if (evidence.race_date !== date || (venue && evidence.venue !== venue) || !Array.isArray(evidence.dividends) || !/^[0-9a-f]{64}$/.test(evidence.source_sha256)
      || !Number.isInteger(evidence.race_count) || evidence.race_count < 1 || evidence.race_count > 15
      || !evidence.trio_combinations || Object.keys(evidence.trio_combinations).length !== evidence.race_count
      || !Object.entries(evidence.trio_combinations).every(([r,c])=>Number(r)>=1 && Number(r)<=evidence.race_count && typeof c==='string' && /^\d+,\d+,\d+$/.test(c))
      || !evidence.dividends.every((r:DividendRow)=>Number.isInteger(r.race_no) && r.race_no>=1 && r.race_no<=evidence.race_count && typeof r.pool==='string' && typeof r.combo==='string' && Number.isFinite(r.dividend) && r.dividend>=0 && r.unit===10)
      || !/^https:\/\/racing\.hkjc\.com\/zh-hk\/local\/information\/resultsall\?/.test(evidence.source_url)) throw new Error('官方派彩存證格式不符');
    return {rows:evidence.dividends,trios:evidence.trio_combinations,source:{url:evidence.source_url,sha256:evidence.source_sha256}};
  }
  return {rows:await fetchRaceDividends(date),trios:{}};
}

const BASE = "https://raw.githubusercontent.com/sleepingarhat/tianxi-racing/main/data";

export async function fetchRaceDividends(date: string): Promise<DividendRow[]> {
  const res = await fetch(`${BASE}/${date.slice(0, 4)}/dividends_${date}.csv`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`派彩讀取失敗 ${res.status}`);
  const lines = (await res.text()).replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const head = lines.shift()?.split(",") ?? [];
  const ix = (k: string) => head.indexOf(k);
  const iR = ix("race_no"), iP = ix("pool"), iC = ix("combination"), iD = ix("dividend_hkd");
  const rows: DividendRow[] = [];
  for (const l of lines) {
    const c = splitCsv(l);
    // These promotional markets are not part of the race-pool accounting.
    if (/騎師王|練馬師王/.test(c[iP] ?? '')) continue;
    const amount = normalizeOfficialDividend(String(c[iD] ?? ""));
    if (!amount) throw new Error("官方派彩含未核實金額或退款狀態，暫停結算");
    rows.push({ race_no: Number(c[iR]), pool: c[iP] ?? "", combo: c[iC] ?? "", unit: 10, ...amount });
  }
  return rows.sort((a, b) => a.race_no - b.race_no);
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
