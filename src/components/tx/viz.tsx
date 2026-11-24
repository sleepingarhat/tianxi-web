import { useEffect, useId, useState } from "react";
import type { ReactNode } from "react";

/** 進度比例動態增長（掛載後由 0 過渡到目標值） */
export function useGrow(ratio: number | null | undefined, delay = 60): number {
  const target = ratio == null || !Number.isFinite(ratio) ? 0 : Math.max(0, Math.min(1, ratio));
  const [v, setV] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setV(target), delay);
    return () => clearTimeout(t);
  }, [target, delay]);
  return v;
}

const BAR_TONE = { gold: "bg-gold", win: "bg-win", lose: "bg-lose", ink: "bg-ink-2" } as const;

/** 純進度條（無標籤），全站行內用；帶動態填充＋光掃 */
export function TxBar({
  ratio,
  tone = "gold",
  height = 5,
  className = "",
  min = 2,
}: {
  ratio: number | null | undefined;
  tone?: "gold" | "win" | "lose" | "ink";
  height?: number;
  className?: string;
  min?: number;
}) {
  const grown = useGrow(ratio);
  return (
    <span className={`tx-bar-track block w-full bg-paper-3 ${className}`} style={{ height }}>
      <span className={`tx-bar-fill ${BAR_TONE[tone]}`} style={{ width: `${Math.max(min, grown * 100)}%` }} />
    </span>
  );
}

/** 動態進度條：橫向填充＋光掃，取代圓環用於覆蓋率／權重顯示 */
export function MeterBar({
  label,
  en,
  value,
  sub,
  ratio,
  tone = "gold",
  height = 7,
}: {
  label: ReactNode;
  en?: string;
  value: ReactNode;
  sub?: ReactNode;
  ratio: number | null | undefined;
  tone?: "gold" | "win" | "lose" | "ink";
  height?: number;
}) {
  const grown = useGrow(ratio);
  const txt = { gold: "text-gold", win: "text-win", lose: "text-lose", ink: "text-ink" }[tone];
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-1.5">
        <p className="min-w-0 truncate text-[10px] font-bold leading-none text-ink-3">
          {label}
          {en ? <span className="ml-1 font-mono-tx text-[11px] tracking-[0.04em] text-ink-3">{en}</span> : null}
        </p>
        <p className={`tabnum shrink-0 font-mono-tx text-[13px] font-bold leading-none ${txt}`}>{value}</p>
      </div>
      <div className="tx-bar-track mt-1.5 w-full bg-paper-3" style={{ height }}>
        <span
          className={`tx-bar-fill ${BAR_TONE[tone]}`}
          style={{ width: `${Math.max(2, grown * 100)}%` }}
        />
      </div>
      {sub ? <p className="tabnum mt-1 font-mono-tx text-[10.5px] leading-none text-ink-3">{sub}</p> : null}
    </div>
  );
}

/** 迷你折線圖（紙墨金風格，無座標軸） */
export function Spark({
  values,
  height = 34,
  tone = "gold",
  fill = true,
}: {
  values: (number | null | undefined)[];
  height?: number;
  tone?: "gold" | "win" | "lose" | "ink";
  fill?: boolean;
}) {
  const pts = values.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null));
  const nums = pts.filter((v): v is number => v != null);
  if (nums.length < 2) return <div className="h-[34px]" />;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1;
  const w = 100;
  const step = w / (pts.length - 1);
  const coords = pts.map((v, i) => (v == null ? null : [i * step, height - ((v - min) / span) * (height - 4) - 2]));
  const line = coords
    .filter((c): c is number[] => !!c)
    .map((c, i) => `${i === 0 ? "M" : "L"}${c[0]!.toFixed(1)},${c[1]!.toFixed(1)}`)
    .join(" ");
  const stroke = { gold: "var(--tx-gold)", win: "var(--tx-win)", lose: "var(--tx-lose)", ink: "var(--tx-ink-2)" }[tone];
  const last = coords.filter((c): c is number[] => !!c).at(-1);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {fill ? <path d={`${line} L${w},${height} L0,${height} Z`} fill={stroke} opacity="0.1" /> : null}
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      {last ? <circle cx={last[0]} cy={last[1]} r="1.8" fill={stroke} /> : null}
    </svg>
  );
}

/** 迷你柱狀圖，可標示目標線 */
export function MiniBars({
  values,
  target,
  height = 40,
  tone = "gold",
}: {
  values: (number | null | undefined)[];
  target?: number | undefined;
  height?: number;
  tone?: "gold" | "win" | "ink";
}) {
  const nums = values.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : 0));
  if (!nums.length) return <div style={{ height }} />;
  const max = Math.max(...nums, target ?? 0) || 1;
  const color = { gold: "bg-gold", win: "bg-win", ink: "bg-ink-2" }[tone];
  const grownBars = useGrow(1);
  return (
    <div className="tx-chart-grid relative flex w-full min-w-0 items-end gap-[3px] overflow-hidden rounded-[4px] px-0.5 pt-1" style={{ height }}>
      {target != null ? (
        <span
          className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-lose/60"
          style={{ bottom: `${(target / max) * 100}%` }}
        />
      ) : null}
      {nums.map((v, i) => (
        <span
          key={i}
          className={`tx-mini-bar min-w-0 flex-1 shrink rounded-t-[2px] transition-[height] duration-700 ease-out ${color} ${
            target != null && v >= target ? "opacity-100" : "opacity-55"
          }`}
          style={{
            height: `${Math.max(3, (v / max) * 100 * grownBars)}%`,
            transitionDelay: `${Math.min(400, i * 22)}ms`,
          }}
        />
      ))}
    </div>
  );
}

/** 主指標磚：大數字＋目標進度＋走勢 */
export function KpiTile({
  label,
  en,
  value,
  unit,
  sub,
  ratio,
  tone = "gold",
  trend,
  target,
}: {
  label: string;
  en?: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  ratio?: number | null;
  tone?: "gold" | "win" | "lose" | "ink";
  trend?: (number | null | undefined)[];
  target?: number | undefined;
}) {
  const bar = { gold: "bg-gold", win: "bg-win", lose: "bg-lose", ink: "bg-ink-2" }[tone];
  const txt = { gold: "text-gold", win: "text-win", lose: "text-lose", ink: "text-ink" }[tone];
  const grownRatio = useGrow(ratio ?? 0);
  return (
    <div className="tx-data-panel relative overflow-hidden rounded-[8px] border border-deep/15 bg-paper p-2.5 shadow-sm">
      <span className={`absolute inset-x-0 top-0 h-[2px] ${bar}`} aria-hidden />
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1">
        <p className="min-w-0 truncate text-[10px] font-bold leading-none text-ink-3">{label}</p>
        {en ? <p className="shrink-0 font-mono-tx text-[11px] tracking-[0.04em] text-ink-3">{en}</p> : null}
      </div>
      <p className={`tabnum mt-1.5 font-mono-tx text-[22px] font-bold leading-none ${txt}`}>
        {value}
        {unit ? <span className="ml-0.5 text-[11px] font-bold text-ink-3">{unit}</span> : null}
      </p>
      {ratio != null ? (
        <div className="tx-bar-track mt-1.5 h-[3px] w-full bg-paper-3">
          <span className={`tx-bar-fill ${bar}`} style={{ width: `${Math.max(2, grownRatio * 100)}%` }} />
        </div>
      ) : null}
      {trend?.length ? (
        <div className="mt-1.5">
          <MiniBars values={trend} target={target} height={24} tone={tone === "lose" ? "ink" : tone} />
        </div>
      ) : null}
      {sub ? <p className="tabnum mt-1 font-mono-tx text-[10.5px] leading-none text-ink-3">{sub}</p> : null}
    </div>
  );
}

/** 橫向比較條（排行榜用）。fillRatio 若提供＝條長度用絕對比例（1 = 滿格） */
export function BarRow({
  label,
  value,
  max,
  fillRatio,
  right,
  sub,
  tone = "gold",
  rank,
}: {
  label: ReactNode;
  value: number;
  max: number;
  fillRatio?: number | null;
  right?: ReactNode;
  sub?: ReactNode;
  tone?: "gold" | "win" | "ink";
  rank?: number;
}) {
  const color = { gold: "bg-gold", win: "bg-win", ink: "bg-ink-2/70" }[tone];
  const ratio = fillRatio != null ? fillRatio : value / (max || 1);
  const grownBar = useGrow(ratio);
  return (
    <div className="border-b border-hairline py-2 last:border-0">
      <div className="flex items-baseline gap-1.5">
        {rank != null ? (
          <span className={`tabnum w-4 shrink-0 font-mono-tx text-[10px] font-bold ${rank === 1 ? "text-gold" : "text-ink-3"}`}>
            {rank}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate font-serif-tc text-[12px] font-bold text-ink">{label}</span>
        {right ? <span className="tabnum shrink-0 font-mono-tx text-[12px] font-bold text-ink">{right}</span> : null}
      </div>
      <div className="tx-bar-track mt-1 h-[5px] w-full bg-paper-3">
        <span className={`tx-bar-fill ${color}`} style={{ width: `${Math.max(1.5, grownBar * 100)}%` }} />
      </div>
      {sub ? <p className="tabnum mt-1 font-mono-tx text-[10.5px] leading-none text-ink-3">{sub}</p> : null}
    </div>
  );
}

/** 走勢圖：面積漸變＋金線＋座標標示（滾動表現用） */
export function TrendChart({
  points,
  height = 120,
  unit = "",
  decimals = 2,
}: {
  points: { label: string; value: number | null | undefined }[];
  height?: number;
  unit?: string;
  decimals?: number;
}) {
  const gradientId = useId().replace(/:/g, "");
  const pts = points.map((p) => ({
    label: p.label,
    v: typeof p.value === "number" && Number.isFinite(p.value) ? p.value : null,
  }));
  const nums = pts.map((p) => p.v).filter((v): v is number => v != null);
  if (nums.length < 2) return <div className="py-6 text-center text-[10px] text-ink-3">資料不足</div>;
  const rawMin = Math.min(...nums);
  const rawMax = Math.max(...nums);
  const pad = (rawMax - rawMin || 1) * 0.15;
  const min = Math.max(0, rawMin - pad);
  const max = rawMax + pad;
  const span = max - min || 1;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  const W = 300;
  const H = height;
  const step = W / Math.max(1, pts.length - 1);
  const y = (v: number) => H - ((v - min) / span) * (H - 8) - 4;
  const coords = pts.map((p, i) => (p.v == null ? null : [i * step, y(p.v)] as [number, number]));
  const solid = coords.filter((c): c is [number, number] => !!c);
  const line = solid.map((c, i) => `${i === 0 ? "M" : "L"}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(" ");
  const fmt = (v: number) => `${v.toFixed(decimals)}${unit}`;
  return (
    <div className="tx-data-panel overflow-hidden rounded-[6px] border border-deep/10 bg-paper-2/40 px-1.5 pb-1.5 pt-2">
      <div className="flex gap-1.5">
        <div className="flex w-9 shrink-0 flex-col justify-between py-[2px] text-right">
          <span className="tabnum font-mono-tx text-[10px] text-ink-3">{fmt(max)}</span>
          <span className="tabnum font-mono-tx text-[10px] text-gold">{fmt(avg)}</span>
          <span className="tabnum font-mono-tx text-[10px] text-ink-3">{fmt(min)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: H }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--tx-gold)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--tx-gold)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((g) => (
              <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="var(--tx-hairline)" strokeWidth="1" />
            ))}
            <line
              x1="0"
              x2={W}
              y1={y(avg)}
              y2={y(avg)}
              stroke="var(--tx-gold)"
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.6"
            />
            <path d={`${line} L${W},${H} L0,${H} Z`} fill={`url(#${gradientId})`} />
            <path className="tx-chart-line" pathLength="1" d={line} fill="none" stroke="var(--tx-gold)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            {solid.map((c, i) => (
              <circle
                key={i}
                cx={c[0]}
                cy={c[1]}
                r={i === solid.length - 1 ? 3.2 : 2}
                className={i === solid.length - 1 ? "tx-chart-beacon" : ""}
                fill={i === solid.length - 1 ? "var(--tx-deep)" : "var(--tx-paper)"}
                stroke="var(--tx-gold)"
                strokeWidth="1.4"
              />
            ))}
          </svg>
          <div className="mt-1 flex justify-between">
            <span className="tabnum font-mono-tx text-[10px] text-ink-3">{pts[0]?.label}</span>
            <span className="tabnum font-mono-tx text-[10px] text-ink-3">{pts.at(-1)?.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}


/** 命中／落空格仔（近況串） */
export function HitStrip({ hits, max = 24 }: { hits: (boolean | null)[]; max?: number }) {
  const arr = hits.slice(-max);
  return (
    <div className="flex flex-wrap gap-[3px]">
      {arr.map((h, i) => (
        <span
          key={i}
          title={h == null ? "未核對" : h ? "命中" : "落空"}
          className={`h-3 w-3 rounded-[2px] ${h == null ? "bg-paper-3" : h ? "bg-win" : "bg-lose/35"}`}
        />
      ))}
      {!arr.length ? <span className="text-[10px] text-ink-3">暫無</span> : null}
    </div>
  );
}

/** 標籤＋數值一行（資料密度用） */
export function KV({ k, v, tone }: { k: ReactNode; v: ReactNode; tone?: "win" | "lose" }) {
  const c = tone === "win" ? "text-win" : tone === "lose" ? "text-lose" : "text-ink";
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-hairline py-1 last:border-0">
      <span className="text-[10px] text-ink-3">{k}</span>
      <span className={`tabnum font-mono-tx text-[11px] font-bold ${c}`}>{v}</span>
    </div>
  );
}

/** 進度圓環（主指標／覆蓋率用） */
export function Ring({
  ratio,
  size = 56,
  stroke = 5,
  label,
  sub,
  tone = "gold",
}: {
  ratio: number | null | undefined;
  size?: number;
  stroke?: number;
  label?: ReactNode;
  sub?: ReactNode;
  tone?: "gold" | "win" | "lose" | "ink";
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = useGrow(ratio);
  const color = { gold: "var(--tx-gold)", win: "var(--tx-win)", lose: "var(--tx-lose)", ink: "var(--tx-ink-2)" }[tone];
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--tx-paper-3)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - v)}
            style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1)" }}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center">
          <span className="tabnum font-mono-tx text-[11px] font-bold text-ink">{label}</span>
        </span>
      </div>
      {sub ? <span className="text-center text-[10.5px] leading-tight text-ink-3">{sub}</span> : null}
    </div>
  );
}

/** 資料籌碼（狀態／標籤密度用） */
export function DataChip({
  k,
  v,
  tone = "ink",
}: {
  k: ReactNode;
  v: ReactNode;
  tone?: "ink" | "gold" | "win" | "lose";
}) {
  const ring = {
    ink: "border-hairline bg-paper",
    gold: "border-gold/50 bg-gold-bg",
    win: "border-win/35 bg-win/8",
    lose: "border-lose/35 bg-lose/8",
  }[tone];
  const dot = { ink: "bg-ink-3", gold: "bg-gold", win: "bg-win", lose: "bg-lose" }[tone];
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2 py-[3px] ${ring}`}>
      <span className={`tx-blink h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="shrink-0 text-[10.5px] text-ink-3">{k}</span>
      <span className="tabnum truncate font-mono-tx text-[10px] font-bold text-ink">{v}</span>
    </span>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

/** 金色流光重點卡（適用精選／重點指標） */
export function BeamCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`tx-beam-card rounded-[12px] border border-gold/40 bg-gold-bg/60 ${className}`}>
      <span className="tx-beam-line" aria-hidden />
      <div className="relative">{children}</div>
    </div>
  );
}

/** 場次時間軸（賽馬日流程） */
export function Timeline({
  items,
}: {
  items: { key: string; time?: string | null; title: ReactNode; sub?: ReactNode; tone?: "gold" | "ink" | "win" }[];
}) {
  return (
    <div className="relative pl-4">
      <span className="absolute bottom-1 left-[5px] top-1 w-px bg-hairline" aria-hidden />
      {items.map((it) => {
        const dot = { gold: "bg-gold", ink: "bg-paper-3 border border-hairline", win: "bg-win" }[it.tone || "ink"];
        return (
          <div key={it.key} className="relative py-1.5">
            <span className={`absolute -left-4 top-[9px] h-[9px] w-[9px] rounded-full ${dot}`} aria-hidden />
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
              <span className="min-w-0 truncate font-serif-tc text-[12px] font-bold text-ink">{it.title}</span>
              <span className="tabnum shrink-0 font-mono-tx text-[10px] text-gold">{it.time || "—"}</span>
            </div>
            {it.sub ? <p className="tabnum mt-0.5 font-mono-tx text-[10.5px] leading-tight text-ink-3">{it.sub}</p> : null}
          </div>
        );
      })}
      {!items.length ? <p className="py-3 text-[10px] text-ink-3">暫無場次</p> : null}
    </div>
  );
}

/** 兩欄資料格（提升密度，取代長串單欄 KV） */
export function KVGrid({ rows }: { rows: { k: ReactNode; v: ReactNode; tone?: "win" | "lose" | undefined }[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
      {rows.map((r, i) => (
        <KV key={i} k={r.k} v={r.v} {...(r.tone ? { tone: r.tone } : {})} />
      ))}
    </div>
  );
}
