import { FEATURE_MAP, type FeatureId } from "@/lib/race-data";
import type { CompositeRow } from "@/lib/feature-ranking";

function rankColor(rank: number) {
  if (rank === 1) return "bg-gold-bg text-gold border-gold-strong/40";
  if (rank <= 3) return "bg-paper-3 text-ink-2 border-hairline";
  return "bg-paper text-ink-3 border-hairline";
}

export function CompositeOverview({
  rows,
  selected,
}: {
  rows: CompositeRow[];
  selected: FeatureId[];
}) {
  if (selected.length === 0) {
    return (
      <section className="border-b border-hairline bg-paper-2 px-3 py-6 text-center">
        <p className="text-xs text-ink-3">請於上方選擇至少一個特徵以運算綜合排序。</p>
      </section>
    );
  }

  const top = rows[0];
  const second = rows[1];
  const hasOdds = rows.some((r) => (r.horse.odds ?? 0) > 0);
  const longshot = hasOdds
    ? ([...rows].sort((a, b) => b.horse.odds - a.horse.odds).find((r) => r.rank <= 5) ??
      rows[rows.length - 1])
    : // 未開跑賽日冇賠率：用「綜合排第 4 名之後但有單項第一」嘅馬做黑馬
      ([...rows].find((r) => r.rank >= 4 && r.leads > 0) ?? rows[3] ?? rows[rows.length - 1]);
  if (!top || !longshot) return null;

  const cards = [
    { label: "全能領先", row: top, tone: "text-win", tag: `綜合 ${top.composite.toFixed(1)}` },
    { label: "次選優勢", row: second, tone: "text-ink-3", tag: `綜合 ${second?.composite.toFixed(1) ?? "-"}` },
    {
      label: "冷門黑馬",
      row: longshot,
      tone: "text-lose",
      tag: hasOdds ? `賠 ${longshot.horse.odds.toFixed(1)}` : `綜合 ${longshot.composite.toFixed(1)}`,
    },
  ].filter((c) => c.row);


  return (
    <section className="border-b border-hairline bg-paper-2 px-3 py-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-serif-tc text-base text-brown">綜合特徵總覽</h2>
        <span className="tabnum rounded-full bg-paper-3 px-2 py-0.5 font-mono-tx text-[11px] text-ink-3">
          {selected.length} 項特徵合成
        </span>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        {cards.map((c, i) => (
          <div
            key={c.label}
            className={
              i === 0
                ? "rounded-md border border-tan bg-paper p-2 shadow-sm"
                : "rounded-md border border-hairline bg-paper p-2 opacity-80"
            }
          >
            <div className="mb-1 text-[11px] text-ink-3">{c.label}</div>
            <div className="font-serif-tc text-sm text-ink">
              {c.row!.horse.no}. {c.row!.horse.name}
            </div>
            <div className={`tabnum font-mono-tx text-[11px] font-bold ${c.tone}`}>{c.tag}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto no-scrollbar rounded-md border border-hairline bg-paper">
        <table className="w-full text-left">
          <thead className="bg-paper-3 text-[11px] font-medium text-ink-3">
            <tr>
              <th className="sticky left-0 z-10 bg-paper-3 py-2 pl-3 pr-2">馬匹</th>
              {selected.map((f) => (
                <th key={f} className="whitespace-nowrap px-2 py-2 text-center">
                  {FEATURE_MAP[f].shortLabel}
                </th>
              ))}
              <th className="whitespace-nowrap px-3 py-2 text-right">綜合</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {rows.map((row) => (
              <tr
                key={row.horse.no}
                className={`border-b border-hairline ${row.rank === 1 ? "bg-gold-bg/30" : ""}`}
              >
                <td
                  className={`sticky left-0 z-10 py-2.5 pl-3 pr-2 ${row.rank === 1 ? "bg-gold-bg" : "bg-paper"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="tabnum w-4 font-mono-tx text-[11px] font-bold text-ink-2">
                      {row.horse.no}
                    </span>
                    <span className="whitespace-nowrap font-serif-tc text-[13px] text-ink">
                      {row.horse.name}
                    </span>
                  </div>
                  <div className="tabnum pl-6 font-mono-tx text-[10px] text-ink-3">
                    {row.leads > 0 ? `${row.leads} 項第一 · ` : ""}平均名次 {row.avgRank.toFixed(1)}
                  </div>
                </td>
                {selected.map((f) => (
                  <td key={f} className="px-2 py-2.5 text-center">
                    <span
                      className={`tabnum inline-flex h-6 w-6 items-center justify-center rounded border font-mono-tx text-[11px] font-bold ${rankColor(row.ranks[f] ?? 99)}`}
                    >
                      {row.ranks[f] ?? "-"}
                    </span>
                  </td>
                ))}
                <td className="tabnum px-3 py-2.5 text-right font-mono-tx text-xs font-bold text-ink">
                  {row.composite.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
