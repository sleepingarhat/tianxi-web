import { MeterBar } from "@/components/tx/viz";

export type CalibBin = {
  lo: number;
  hi: number;
  n: number;
  predictedPct: number | null;
  actualPct: number | null;
};

export type Calibration = {
  bins?: CalibBin[];
  samples?: number | null;
  ece?: number | null;
  slope?: number | null;
  intercept?: number | null;
};

/** 可靠度圖（reliability diagram）：引擎講嘅機率 vs 實際發生頻率。 */
export function ReliabilityChart({ calib, max = 70 }: { calib?: Calibration | null; max?: number }) {
  const bins = (calib?.bins || []).filter((b) => b.n > 0);
  if (!bins.length) return <p className="text-[11px] text-ink-3">樣本不足，暫無可靠度資料。</p>;

  const W = 300;
  const H = 190;
  const pad = { l: 30, r: 8, t: 8, b: 22 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (v: number) => pad.l + (Math.min(v, max) / max) * iw;
  const y = (v: number) => pad.t + ih - (Math.min(v, max) / max) * ih;
  const pts = bins
    .filter((b) => b.predictedPct != null && b.actualPct != null)
    .map((b) => ({ px: x(b.predictedPct!), py: y(b.actualPct!), b }));
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(" ");
  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max];

  return (
    <div className="min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="可靠度圖">
        {ticks.map((t) => (
          <g key={`g${t}`}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={y(t)}
              y2={y(t)}
              stroke="currentColor"
              className="text-hairline"
              strokeWidth="0.6"
            />
            <text x={pad.l - 4} y={y(t) + 3} textAnchor="end" className="fill-current text-ink-3" fontSize="7">
              {Math.round(t)}%
            </text>
          </g>
        ))}
        {/* 完美校準對角線 */}
        <line
          x1={x(0)}
          y1={y(0)}
          x2={x(max)}
          y2={y(max)}
          stroke="currentColor"
          className="text-ink-3"
          strokeWidth="0.8"
          strokeDasharray="3 3"
        />
        <path d={path} fill="none" stroke="currentColor" className="text-gold" strokeWidth="1.6" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.px} cy={p.py} r={Math.max(2, Math.min(5, Math.sqrt(p.b.n) / 3))} className="fill-current text-gold" />
        ))}
        <text x={W - pad.r} y={H - 4} textAnchor="end" className="fill-current text-ink-3" fontSize="7">
          橫軸＝引擎機率　縱軸＝實際頻率
        </text>
      </svg>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <MeterBar
          label="校準誤差 ECE"
          en="ECE"
          value={calib?.ece != null ? `${(calib.ece * 100).toFixed(2)}%` : "—"}
          sub="越細越準（<2% 良好）"
          ratio={calib?.ece != null ? Math.max(0, 1 - calib.ece / 0.1) : null}
          tone={calib?.ece != null && calib.ece <= 0.02 ? "win" : "gold"}
        />
        <MeterBar
          label="校準斜率"
          en="Slope"
          value={calib?.slope != null ? calib.slope.toFixed(2) : "—"}
          sub="1.00＝機率大小恰當；<1＝過度自信"
          ratio={calib?.slope != null ? Math.max(0, Math.min(1, calib.slope)) : null}
          tone={calib?.slope != null && calib.slope >= 0.9 ? "win" : "gold"}
        />
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[280px] text-[11px]">
          <thead className="text-ink-3">
            <tr>
              <th className="py-1 text-left font-bold">機率區間</th>
              <th className="py-1 text-right font-bold">樣本</th>
              <th className="py-1 text-right font-bold">引擎講</th>
              <th className="py-1 text-right font-bold">實際</th>
            </tr>
          </thead>
          <tbody className="tabnum divide-y divide-hairline font-mono-tx">
            {bins.map((b) => {
              const gap = b.predictedPct != null && b.actualPct != null ? b.actualPct - b.predictedPct : null;
              return (
                <tr key={`${b.lo}-${b.hi}`}>
                  <td className="py-1 text-left">
                    {b.lo}–{b.hi}%
                  </td>
                  <td className="py-1 text-right text-ink-3">{b.n}</td>
                  <td className="py-1 text-right">{b.predictedPct ?? "—"}%</td>
                  <td className={`py-1 text-right font-bold ${gap == null ? "" : gap >= 0 ? "text-win" : "text-lose"}`}>
                    {b.actualPct ?? "—"}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
