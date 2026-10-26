import { heatBg, heatTone, formatPp } from "@/lib/lab-going-ui";
import type { LabGoingHeatCell } from "@/lib/lab-going.functions";

type Props = {
  draws: number[];
  distances: number[];
  cells: LabGoingHeatCell[];
  /** 手機：只顯示單一途程列 */
  focusDistance?: number | null;
};

export function GoingHeatmap({ draws, distances, cells, focusDistance }: Props) {
  const dists =
    focusDistance != null && distances.includes(focusDistance)
      ? [focusDistance]
      : distances;

  const lookup = new Map(cells.map((c) => [`${c.draw}|${c.distance}`, c]));

  if (!dists.length) {
    return <p className="text-[12px] text-ink-3">暫無足夠歷史樣本繪熱圖。</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-[10px]">
        <thead>
          <tr>
            <th className="sticky left-0 bg-paper px-1 py-1 text-left font-medium text-ink-3">
              檔＼程
            </th>
            {dists.map((d) => (
              <th key={d} className="px-1 py-1 text-center font-medium text-ink-3">
                {d}m
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {draws.map((draw) => (
            <tr key={draw}>
              <td className="sticky left-0 bg-paper px-1 py-0.5 font-bold text-ink-2">{draw}</td>
              {dists.map((d) => {
                const cell = lookup.get(`${draw}|${d}`);
                const tone = heatTone(cell?.deltaVsAvg, cell?.sparse ?? true);
                const title = cell
                  ? `檔${draw} · ${d}m · 三甲 ${cell.top3}/${cell.runners} · 場數 ${cell.races}${cell.sparse ? " · 樣本不足" : ""} · Δ ${formatPp(cell.deltaVsAvg)}`
                  : "無資料";
                return (
                  <td key={d} className="p-0.5" title={title}>
                    <div
                      className={`flex h-7 items-center justify-center rounded-[3px] font-mono ${heatBg(tone)}`}
                    >
                      {cell && !cell.sparse && cell.deltaVsAvg != null
                        ? formatPp(cell.deltaVsAvg, 0)
                        : cell?.sparse
                          ? "·"
                          : "—"}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1.5 text-[9px] text-ink-3">
        色調＝三甲率減平均；灰＝樣本 &lt; 門檻。手機可揀單一途程睇單列。
      </p>
    </div>
  );
}
