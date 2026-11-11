import { useState } from "react";

import { TxBar } from "@/components/tx/viz";
import { explainHorse, type WhyFactor } from "@/lib/why-picked";
import type { Horse } from "@/lib/race-data";

function FactorRow({ f, maxAbs, tone }: { f: WhyFactor; maxAbs: number; tone: "win" | "lose" }) {
  const ratio = Math.min(1, Math.abs(f.contribution) / maxAbs);
  return (
    <div className="min-w-0 py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate font-serif-tc text-[11px] font-bold text-ink">{f.label}</p>
        <p className={`tabnum shrink-0 font-mono-tx text-[11px] font-bold ${tone === "win" ? "text-win" : "text-lose"}`}>
          {f.contribution > 0 ? "+" : "−"}
          {Math.abs(f.contribution).toFixed(2)}
        </p>
      </div>
      <TxBar ratio={ratio} tone={tone} height={4} className="mt-1" />
      <p className="tabnum mt-1 font-mono-tx text-[10px] leading-relaxed text-ink-3">
        全場第 {f.rank}／{f.total} · {f.metricLabel} {f.metric} · 權重 {(f.weight * 100).toFixed(0)}%
      </p>
    </div>
  );
}

/** 可展開嘅「點解揀佢」面板：列出推高／拉低該匹馬排名嘅特徵。 */
export function WhyPicked({
  horses,
  horseNo,
  name,
  defaultOpen = false,
}: {
  horses: Horse[];
  horseNo: number;
  name?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const why = explainHorse(horses, horseNo);
  if (!why || (!why.up.length && !why.down.length)) return null;

  return (
    <div className="rounded-[8px] border border-hairline bg-paper-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left"
        aria-expanded={open}
      >
        <span className="font-serif-tc text-[11px] font-bold text-ink">點解揀佢</span>
        <span className="font-mono-tx text-[11px] tracking-[0.04em] text-ink-3">Why</span>
        {name ? <span className="truncate font-serif-tc text-[11px] text-ink-2">· {name}</span> : null}
        <span
          className={`tabnum ml-auto shrink-0 rounded-[3px] border px-1 font-mono-tx text-[10px] font-bold ${
            why.net >= 0 ? "border-win/45 bg-win/10 text-win" : "border-lose/45 bg-lose/10 text-lose"
          }`}
        >
          {why.net >= 0 ? "+" : "−"}
          {Math.abs(why.net).toFixed(2)}
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 shrink-0 text-ink-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div className="border-t border-hairline px-2.5 pb-2.5 pt-1.5">
          <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
            <div className="min-w-0">
              <p className="mb-0.5 text-[11px] font-medium tracking-[0.04em] text-win">推高排名</p>
              {why.up.length ? (
                why.up.map((f) => <FactorRow key={f.id} f={f} maxAbs={why.maxAbs} tone="win" />)
              ) : (
                <p className="py-1.5 text-[11px] text-ink-3">冇明顯優勢項</p>
              )}
            </div>
            <div className="min-w-0">
              <p className="mb-0.5 text-[11px] font-medium tracking-[0.04em] text-lose">拉低排名</p>
              {why.down.length ? (
                why.down.map((f) => <FactorRow key={f.id} f={f} maxAbs={why.maxAbs} tone="lose" />)
              ) : (
                <p className="py-1.5 text-[11px] text-ink-3">冇明顯弱項</p>
              )}
            </div>
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-ink-3">
            數值＝該項特徵同場標準化分數 × 天喜LGB 特徵重要度權重，正數推高、負數拉低；屬局部解釋，只用該場之前嘅歷史資料計算，非投注建議。
          </p>
        </div>
      ) : null}
    </div>
  );
}
