import { useQuery } from "@tanstack/react-query";

import { Card, Loading } from "@/components/tx/ui";

/**
 * closeGap 分位圖 + lock-tick 實測準備（研究展示層）。
 * 資料源：H-R2 公開研究報告（開賽前／鎖點快照嘅頭兩匹獨贏差分位）＋ /api/public/lock-state。
 * 唔改四揀、唔改模型、唔寫死門檻——樣本 ≥200 場先寫死 closeGap，「頭馬接近」章先出。
 */

type HR2Report = {
  generatedAt?: string;
  prelockSnapshot?: {
    races?: number;
    runners?: number;
    modelWinLogloss?: number;
    marketWinLogloss?: number;
    closeGapQuantiles?: { p10?: number; p25?: number; p50?: number; p75?: number; p90?: number };
  };
  closeGap?: { status?: string; reason?: string; sampleRaces?: number; threshold?: number };
};

type LockState = {
  date?: string;
  venue?: string;
  firstPostAt?: string;
  lockAt?: string;
  locked?: boolean;
  minutesToLock?: number;
  frozenRows?: number;
  lockLeadMinutes?: number;
};

const QROWS: { key: "p10" | "p25" | "p50" | "p75" | "p90"; label: string; p: number }[] = [
  { key: "p10", label: "p10", p: 0.1 },
  { key: "p25", label: "p25", p: 0.25 },
  { key: "p50", label: "p50", p: 0.5 },
  { key: "p75", label: "p75", p: 0.75 },
  { key: "p90", label: "p90", p: 0.9 },
];

// 分位函數：以 H-R2 五個分位點做分段線性插值（0 起點）。
function inverseQ(pts: [number, number][], p: number): number {
  if (!pts.length) return 0;
  if (p <= 0) return 0;
  const [p0v, v0v] = pts[0]!;
  if (p <= p0v) return (p / p0v) * v0v;
  for (let i = 1; i < pts.length; i += 1) {
    const [p0, v0] = pts[i - 1]!;
    const [p1, v1] = pts[i]!;
    if (p <= p1) return v0 + ((p - p0) / (p1 - p0)) * (v1 - v0);
  }
  const [pl, vl] = pts[pts.length - 1]!;
  return vl + (p - pl) * 0.4; // 尾部緩慢外推，只作顯示
}

/** 次序統計量近似 95% 區間：rank = n·p ± 1.96·√(n·p·(1−p))，經分位函數映射返數值。 */
function quantileBand(pts: [number, number][], p: number, n: number): [number, number] {
  const z = 1.96;
  const half = z * Math.sqrt(n * p * (1 - p));
  const lo = Math.max(0.5, n * p - half) / n;
  const hi = Math.min(n - 0.5, n * p + half) / n;
  return [inverseQ(pts, lo), inverseQ(pts, hi)];
}

const pctAxis = (v: number, max: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;

export function CloseGapPanel() {
  const hr2 = useQuery<HR2Report>({
    queryKey: ["horseHr2"],
    queryFn: async () => {
      const res = await fetch("/api/public/horse-hr2");
      if (!res.ok) throw new Error("h-r2 讀取失敗");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
  const lock = useQuery<LockState | null>({
    queryKey: ["lockStatePanel"],
    queryFn: async () => {
      const res = await fetch("/api/public/lock-state");
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 120_000,
  });

  const pre = hr2.data?.prelockSnapshot;
  const q = pre?.closeGapQuantiles;
  const sampleRaces = hr2.data?.closeGap?.sampleRaces ?? pre?.races ?? 0;
  const threshold = hr2.data?.closeGap?.threshold ?? 200;
  const progress = threshold ? Math.min(100, (sampleRaces / threshold) * 100) : 0;

  const pts: [number, number][] | null = q
    ? QROWS.map((r) => [r.p, q[r.key] ?? 0] as [number, number])
    : null;
  const axisMax = pts && pts.length ? Math.max(0.12, Math.ceil((pts[pts.length - 1]![1] * 1.25) / 0.02) * 0.02) : 0.16;

  const l = lock.data;
  const lockHkt = l?.lockAt ? new Date(l.lockAt).toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : null;
  const firstPostHkt = l?.firstPostAt ? new Date(l.firstPostAt).toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : null;

  return (
    <Card title="closeGap 分位追蹤" en="Close-Gap Quantiles">
      {hr2.isLoading || lock.isLoading ? (
        <Loading />
      ) : !pts ? (
        <p className="text-[12px] text-ink-3">H-R2 研究報告暫時讀唔到，稍後再試。</p>
      ) : (
        <div className="space-y-3">
          <p className="text-[11.5px] leading-relaxed text-ink-2">
            「頭兩匹獨贏差」分位用嚟校準「頭馬接近」章嘅門檻。門檻要快照累積到 {threshold} 場先寫死；而家有開賽前快照嘅場次得 <b className="text-ink">{sampleRaces} 場</b>，closeGap 維持 <b className="text-ink">null</b>，標籤未出。
          </p>

          {/* 累積進度 */}
          <div>
            <div className="mb-1 flex items-baseline justify-between text-[10.5px] text-ink-3">
              <span>快照累積</span>
              <span className="tabnum font-mono-tx">{sampleRaces} / {threshold} 場 · {progress.toFixed(0)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full border border-hairline bg-paper-2">
              <div className="h-full rounded-full bg-gold/70" style={{ width: `${Math.max(1.5, progress)}%` }} />
            </div>
          </div>

          {/* 分位圖：18 場實測 ± 次序統計量區間；200 場投影收窄帶 */}
          <div className="rounded-[10px] border border-hairline bg-paper px-2.5 py-2.5">
            <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9.5px] text-ink-3">
              <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full bg-gold" />而家（{sampleRaces} 場實測）</span>
              <span className="flex items-center gap-1"><i className="inline-block h-1.5 w-4 rounded-full bg-gold/30" />n={sampleRaces} 場區間</span>
              <span className="flex items-center gap-1"><i className="inline-block h-1.5 w-4 rounded-full bg-emerald-700/50" />累積到 {threshold} 場投影</span>
            </div>
            <div className="space-y-1.5">
              {QROWS.map((r) => {
                const v = q?.[r.key] ?? 0;
                const [lo18, hi18] = quantileBand(pts, r.p, sampleRaces);
                const [lo200, hi200] = quantileBand(pts, r.p, threshold);
                return (
                  <div key={r.key} className="relative h-6">
                    <span className="absolute -left-0.5 top-1/2 -translate-y-1/2 text-[9.5px] tabnum text-ink-3">{r.label}</span>
                    <div className="absolute inset-y-0 left-8 right-9">
                      {/* n 場區間 */}
                      <div
                        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gold/30"
                        style={{ left: pctAxis(lo18, axisMax), width: pctAxis(Math.max(0.001, hi18 - lo18), axisMax) }}
                      />
                      {/* 200 場投影帶 */}
                      <div
                        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-emerald-700/45"
                        style={{ left: pctAxis(lo200, axisMax), width: pctAxis(Math.max(0.001, hi200 - lo200), axisMax) }}
                      />
                      {/* 實測分位點 */}
                      <div
                        className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-hairline bg-gold"
                        style={{ left: pctAxis(v, axisMax) }}
                      />
                    </div>
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[9.5px] tabnum font-mono-tx text-ink-2">{v.toFixed(3)}</span>
                  </div>
                );
              })}
              <div className="flex justify-between pt-0.5 text-[8.5px] tabnum text-ink-3" style={{ paddingLeft: "2rem", paddingRight: "2.25rem" }}>
                <span>0</span><span>{(axisMax / 2).toFixed(2)}</span><span>{axisMax.toFixed(2)}</span>
              </div>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-ink-3">
              區間用次序統計量 95% 近似由而家分位投影；到 {threshold} 場時帶會收窄，中位（p50）附近最穩。呢個係研究投影，唔係額外資料，唔會倒饋入模型。
            </p>
          </div>

          {/* lock-tick 實測準備 */}
          <div className="rounded-[10px] border border-hairline bg-paper px-2.5 py-2.5">
            <p className="mb-1.5 text-[11px] font-bold text-ink">lock-tick 實測準備</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10.5px]">
              <span className="text-ink-3">下一賽日</span><span className="tabnum text-right font-mono-tx text-ink">{l?.date ?? "—"}{l?.venue ? ` · ${l.venue}` : ""}</span>
              <span className="text-ink-3">首場開跑</span><span className="tabnum text-right font-mono-tx text-ink">{firstPostHkt ?? "—"}</span>
              <span className="text-ink-3">全日鎖點（T−90）</span><span className="tabnum text-right font-mono-tx text-ink">{lockHkt ?? "—"}{l?.locked ? " · 已鎖" : ""}</span>
              <span className="text-ink-3">距鎖點</span><span className="tabnum text-right font-mono-tx text-ink">{l?.minutesToLock != null ? `${Math.round(l.minutesToLock / 60)} 小時 ${l.minutesToLock % 60} 分` : "—"}</span>
              <span className="text-ink-3">目前凍結行數</span><span className="tabnum text-right font-mono-tx text-ink">{l?.frozenRows ?? "—"}</span>
            </div>
            <ul className="mt-1.5 space-y-0.5 text-[9.5px] leading-relaxed text-ink-3">
              <li>· 到鎖點後若全日快照未齊，lock-tick 自動補寫一次：只補缺場、不覆寫已鎖場、不補過去賽日。</li>
              <li>· 實測核對：鎖點前後凍結行數一致、全日場次齊全，先當 pass。</li>
              <li>· 鎖後場照標「鎖後、唔計分」；只有開賽前快照嘅場次先入 closeGap 樣本。</li>
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
