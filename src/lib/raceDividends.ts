// 官方派彩（每 $10 一注）：直接讀 tianxi-racing 倉每日派彩檔 data/YYYY/dividends_DATE.csv
export type DividendRow = { race_no: number; pool: string; combo: string; dividend: number; unit: number };

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
    const value = String(c[iD] ?? "").replace(/,/g, "").trim();
    if (!value || !/^\d+(?:\.\d+)?$/.test(value)) throw new Error("官方派彩含未核實金額或退款狀態，暫停結算");
    const dividend = Number(value);
    if (!Number.isFinite(dividend)) throw new Error("官方派彩金額無效");
    rows.push({ race_no: Number(c[iR]), pool: c[iP] ?? "", combo: c[iC] ?? "", dividend, unit: 10 });
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
