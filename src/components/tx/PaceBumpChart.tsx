import { positionToY } from "@/lib/lab-pace-ui";

export type BumpRunner = {
  horseId: string;
  horseNumber: number | null;
  nameCh: string | null;
  positions: (number | null)[];
  highlight?: boolean | undefined;
  roleLabel?: string | null | undefined;
};

const COLORS = [
  "#c9a227",
  "#2f6fed",
  "#c45c26",
  "#1a7f4b",
  "#7a5af8",
  "#b42318",
  "#0e7490",
  "#a16207",
];

/** 走位 bump chart：高亮最多四揀／前四名；其餘淡線。 */
export function PaceBumpChart({
  runners,
  maxPos,
}: {
  runners: BumpRunner[];
  maxPos: number;
}) {
  const width = 360;
  const height = 220;
  const padL = 28;
  const padR = 56;
  const stages = Math.max(
    1,
    ...runners.map((r) => r.positions.filter((p) => p != null).length),
  );
  const xs = Array.from({ length: stages }, (_, i) => {
    if (stages === 1) return padL + (width - padL - padR) / 2;
    return padL + (i / (stages - 1)) * (width - padL - padR);
  });

  const ordered = [...runners].sort((a, b) => Number(b.highlight) - Number(a.highlight));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="沿途走位圖">
      {/* grid */}
      {Array.from({ length: Math.min(maxPos, 14) }, (_, i) => i + 1).map((pos) => {
        const y = positionToY(pos, maxPos, height);
        return (
          <g key={pos}>
            <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.08} />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize={8} fill="currentColor" opacity={0.45}>
              {pos}
            </text>
          </g>
        );
      })}
      {ordered.map((r, idx) => {
        const pts = r.positions
          .map((p, i) => (p != null && i < stages ? { x: xs[i]!, y: positionToY(p, maxPos, height), p } : null))
          .filter(Boolean) as { x: number; y: number; p: number }[];
        if (pts.length < 1) return null;
        const color = COLORS[idx % COLORS.length]!;
        const hi = Boolean(r.highlight);
        const d = pts.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x},${pt.y}`).join(" ");
        const last = pts[pts.length - 1]!;
        return (
          <g key={r.horseId} opacity={hi ? 1 : 0.28}>
            <path d={d} fill="none" stroke={color} strokeWidth={hi ? 2.4 : 1.2} strokeLinejoin="round" />
            {pts.map((pt, i) => (
              <circle key={i} cx={pt.x} cy={pt.y} r={hi ? 3.2 : 2} fill={color} />
            ))}
            <text x={last.x + 6} y={last.y + 3} fontSize={9} fontWeight={hi ? 700 : 500} fill={color}>
              {r.horseNumber ?? "—"}
              {r.nameCh ? ` ${r.nameCh.slice(0, 4)}` : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
