// 模型 vs 市場啞鈴圖：只讀展示，唔改任何預測數值。
// 金色＝引擎勝算（pWin），青色＝除水市場機率（1/賠率歸一化），按差距 pp 絕對值排序。
// 入場＝入實際頭四名（入 Q）：讀凍結 pTop4；入場排名按該機率喺全場排序（同機率並列）。

import { entryRankMap } from "@/lib/entry-rank";

type Row = {
  horseNumber: string | number;
  nameCh?: string;
  pWin?: number | null;
  pTop4?: number | null;
  od?: number | null;
};

function pctFmt(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

export function ModelVsMarketDumbbell({
  picks,
  maxRows = 8,
  oddsNote,
}: {
  picks: Row[];
  maxRows?: number;
  oddsNote?: string | null;
}) {
  const all = picks || [];
  // 入場排名用全場（包含未入圖嘅馬），唔係只計顯示嘅嗰幾匹。
  const ranks = entryRankMap(all);

  const rows = all
    .map((p) => {
      const od = typeof p.od === "number" && p.od > 0 ? p.od : null;
      const pWin = typeof p.pWin === "number" ? p.pWin : null;
      return { ...p, od, pWin, raw: od ? 1 / od : null };
    })
    .filter((p) => p.pWin != null && p.raw != null);

  if (rows.length < 2) {
    return <p className="py-3 text-[10px] text-ink-3">等臨場盤口，有齊賠率後自動顯示對照。</p>;
  }

  const sum = rows.reduce((a, r) => a + (r.raw as number), 0);
  const data = rows
    .map((r) => {
      const market = (r.raw as number) / sum; // 除水
      const model = r.pWin as number;
      return {
        ...r,
        market,
        model,
        gapPp: (model - market) * 100,
        entry: typeof r.pTop4 === "number" && isFinite(r.pTop4) ? r.pTop4 : null,
        entryRank: ranks.get(String(r.horseNumber)) ?? null,
      };
    })
    .sort((a, b) => Math.abs(b.gapPp) - Math.abs(a.gapPp))
    .slice(0, maxRows);

  const maxV = Math.max(...data.flatMap((d) => [d.model, d.market]), 0.01);
  const scale = maxV * 1.12;
  const pos = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono-tx text-[9px] text-ink-3">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-gold" /> 引擎勝算
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-market" /> 市場機率（除水）
        </span>
        <span className="text-win">入場＝入頭四名（入 Q）</span>
        <span className="ml-auto">按差距 pp 排序</span>
      </div>
      <div className="divide-y divide-hairline">
        {data.map((d) => {
          const left = Math.min(d.model, d.market);
          const width = Math.abs(d.model - d.market);
          const over = d.gapPp > 0;
          return (
            <div key={d.horseNumber} className="py-1.5">
              <div className="grid grid-cols-[76px_minmax(0,1fr)_62px] items-center gap-2">
                <div className="min-w-0">
                  <span className="tabnum font-mono-tx text-[10px] font-bold text-ink">#{d.horseNumber}</span>
                  <span className="ml-1 truncate font-serif-tc text-[10px] font-bold text-ink-2">{d.nameCh || ""}</span>
                </div>
                <div className="relative h-4">
                  <span
                    className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-hairline"
                    style={{ left: pos(left), width: `max(2px, ${(width / scale) * 100}%)` }}
                  />
                  <span
                    className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold ring-2 ring-gold/25"
                    style={{ left: pos(d.model) }}
                    title={`引擎 ${pctFmt(d.model)}`}
                  />
                  <span
                    className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-market ring-2 ring-market/25"
                    style={{ left: pos(d.market) }}
                    title={`市場 ${pctFmt(d.market)}`}
                  />
                </div>
                <div className="tabnum text-right font-mono-tx text-[9px] leading-tight">
                  <span className={`block font-bold ${over ? "text-gold" : "text-market"}`}>
                    {over ? "+" : ""}
                    {d.gapPp.toFixed(1)}pp
                  </span>
                </div>
              </div>
              <div className="mt-1 grid grid-cols-4 gap-1 font-mono-tx text-[8px] leading-tight text-ink-3">
                <span>
                  模型勝算
                  <b className="tabnum mt-0.5 block text-[10px] font-bold text-gold">{pctFmt(d.model)}</b>
                </span>
                <span>
                  市場機率
                  <b className="tabnum mt-0.5 block text-[10px] font-bold text-market">{pctFmt(d.market)}</b>
                </span>
                <span>
                  入場機率
                  <b className="tabnum mt-0.5 block text-[10px] font-bold text-win">
                    {d.entry != null ? pctFmt(d.entry) : "—"}
                  </b>
                </span>
                <span>
                  入場排名
                  <b className="tabnum mt-0.5 block text-[10px] font-bold text-ink">
                    {d.entryRank != null ? `#${d.entryRank}` : "—"}
                  </b>
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[9px] leading-relaxed text-ink-3">
        市場機率由即時獨贏賠率除水（歸一化）推算；入場機率＝模型估算該馬進入實際頭四名（入 Q）之機率，入場排名按該機率喺全場排序（同機率並列）。兩者只作對照，唔會改動引擎排名，亦非投注建議。
      </p>
      {oddsNote ? <p className="mt-1 font-mono-tx text-[9px] text-ink-3">{oddsNote}</p> : null}
    </div>
  );
}
