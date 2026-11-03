import { FEATURE_MAP, type FeatureId } from "@/lib/race-data";
import type { FeatureRow } from "@/lib/feature-ranking";

export function FeatureRankingTable({
  selected,
  active,
  onSelectActive,
  rows,
}: {
  selected: FeatureId[];
  active: FeatureId | null;
  onSelectActive: (id: FeatureId) => void;
  rows: FeatureRow[];
}) {
  const def = active ? FEATURE_MAP[active] : null;
  const showPct = rows.some((r) => r.win > 0);

  return (
    <section className="mt-2">
      <div className="no-scrollbar overflow-x-auto whitespace-nowrap border-b border-hairline px-3">
        <div className="flex gap-4">
          {selected.map((f) => {
            const on = f === active;
            return (
              <button
                key={f}
                type="button"
                onClick={() => onSelectActive(f)}
                className={
                  on
                    ? "border-b-2 border-tx-accent py-3 text-xs font-bold text-ink"
                    : "border-b-2 border-transparent py-3 text-xs text-ink-3"
                }
              >
                {FEATURE_MAP[f].shortLabel}
              </button>
            );
          })}
          {selected.length === 0 && (
            <span className="py-3 text-xs text-ink-3">未選擇特徵</span>
          )}
        </div>
      </div>

      {def && (
        <>
          <p className="bg-paper-2 px-3 py-1.5 text-[11px] text-ink-3">{def.note}</p>
          <table className="w-full text-left">
            <thead className="bg-paper-3 text-[11px] font-medium text-ink-3">
              <tr>
                <th className="w-11 py-2 pl-4">名次</th>
                <th className="py-2 pr-3">馬匹</th>
                <th className="w-[76px] px-2 py-2 text-right">即時賠率</th>
                <th className="w-24 py-2 pl-3 text-right">{def.metricLabel}</th>
                {showPct && <th className="w-14 py-2 text-right">W%</th>}
                {showPct && <th className="w-14 py-2 pr-4 text-right">P%</th>}
                {!showPct && <th className="w-16 py-2 pr-4 text-right">評分</th>}
              </tr>
            </thead>
            <tbody className="text-sm">
              {rows.map((row) => (
                <tr
                  key={row.horse.no}
                  className={`border-b border-hairline ${row.rank === 1 ? "bg-gold-bg/30" : ""}`}
                >
                  <td
                    className={`tabnum py-3 pl-4 font-mono-tx ${row.rank === 1 ? "font-bold text-gold" : "text-ink-3"}`}
                  >
                    {String(row.rank).padStart(2, "0")}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="font-serif-tc text-ink">
                      {row.horse.no}. {row.horse.name}
                    </div>
                    <div className="tabnum font-mono-tx text-[10px] text-ink-3">
                      {row.horse.age ? `${row.horse.age}Y • ` : ""}
                      {row.horse.trainer} / {row.horse.jockey}
                    </div>

                  </td>
                  <td
                    className={`tabnum px-2 py-3 text-right font-mono-tx text-xs ${
                      row.horse.odds > 0 && row.horse.odds <= 5 ? "text-gold" : "text-ink-2"
                    }`}
                  >
                    {row.horse.odds > 0 ? row.horse.odds.toFixed(1) : "—"}
                  </td>
                  <td className="tabnum py-3 pl-3 text-right font-mono-tx text-xs text-ink">
                    {row.metric}
                  </td>
                  {showPct && (
                    <td
                      className={`tabnum py-3 text-right font-mono-tx text-xs ${row.win >= 40 ? "text-win" : row.win < 15 ? "text-lose" : "text-ink"}`}
                    >
                      {row.win.toFixed(1)}
                    </td>
                  )}
                  {showPct && (
                    <td className="tabnum py-3 pr-4 text-right font-mono-tx text-xs text-ink">
                      {row.place.toFixed(1)}
                    </td>
                  )}
                  {!showPct && (
                    <td className="tabnum py-3 pr-4 text-right font-mono-tx text-xs text-ink">
                      {row.score.toFixed(0)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
