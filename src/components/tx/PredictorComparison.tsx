import { Link } from "@tanstack/react-router";
import { Pill } from "@/components/tx/ui";
import { pct } from "@/lib/tx-api";
import type { MergedPick } from "@/lib/use-today-picks";
import type { liveWithdrawal } from "@/lib/live-racing-changes";
import type { effectiveTop4 } from "@/lib/withdrawal-substitution";

type DisplayPick = MergedPick & {
  od: number | null;
  officialChange?: ReturnType<typeof liveWithdrawal>;
};

/** Pure display: odds/ranks and validity decisions remain in the route. */
export function PredictorComparison({ modelCol, marketCol, locked, sub }: {
  modelCol: DisplayPick[];
  marketCol: DisplayPick[];
  locked: boolean;
  sub: ReturnType<typeof effectiveTop4>;
}) {
  return (
        <div className="mx-4 mb-3 grid grid-cols-2 items-stretch gap-2">
          <div
            className={`flex h-full flex-col rounded-[10px] border p-2.5 transition-colors duration-500 ${
              locked ? "tx-beam-card tx-beam-line tx-beam-win border-win/45 bg-win/[0.06]" : "border-hairline bg-paper"
            }`}
          >
            <p className="mb-2 flex min-h-[18px] items-center gap-1 font-serif-tc text-[12px] font-bold text-ink">
              天喜預測 <span className="font-mono-tx text-[10px] font-normal text-ink-3">Tianxi</span>
              {locked ? (
                <span className="ml-auto shrink-0 rounded-[3px] border border-win/45 bg-win/10 px-1 font-mono-tx text-[10px] font-bold text-win">
                  已鎖定
                </span>
              ) : null}
            </p>
            <div className="flex flex-1 flex-col divide-y divide-hairline">
              {modelCol.length ? (
                modelCol.map((p, i) => (
                  <div
                    key={p.horseNumber}
                    className={`min-h-[74px] py-2 ${p.officialChange ? "opacity-60" : ""}`}
                  >
                    <div className="grid grid-cols-[16px_24px_minmax(0,1fr)] items-center gap-1.5">
                      <span className={`tabnum text-center font-mono-tx text-[11px] font-bold ${i === 0 ? "text-gold" : "text-ink-3"}`}>
                        {i + 1}
                      </span>
                      <span className="tabnum grid h-6 w-6 place-items-center rounded-[4px] border border-gold-strong/45 bg-paper-2 font-mono-tx text-[11px] font-bold text-ink">
                        {p.horseNumber}
                      </span>
                      <div className="min-w-0">
                        {p.horseId ? (
                          <Link to="/horse" search={{ id: p.horseId }} className="block truncate font-serif-tc text-[12px] font-bold text-ink">
                            {p.nameCh}
                          </Link>
                        ) : (
                          <span className="block truncate font-serif-tc text-[12px] font-bold text-ink">{p.nameCh}</span>
                        )}
                        <p className="tabnum mt-0.5 truncate font-mono-tx text-[10px] text-ink-3">檔 {p.draw ?? "—"} · 三甲 {pct(p.pTop3)}</p>
                        {p.officialChange ? (
                          <Link to="/race-changes" className="mt-1 block">
                            <Pill tone="lose">
                              {p.officialChange.kind === "replaced" ? `已退出・由${p.officialChange.replacement}補上` : "已退出"}
                            </Pill>
                            <span className="mt-0.5 block font-mono-tx text-[10px] text-lose">
                              馬會 {p.officialChange.announcedAt} 公布{p.officialChange.beforeLock ? "（鎖定前）" : ""}
                            </span>
                          </Link>
                        ) : null}
                      </div>
                    </div>
                    <PickStats pWin={p.pWin} od={p.od} />
                  </div>
                ))
              ) : (
                <p className="py-3 text-[11px] text-ink-3">此場整備中</p>
              )}
            </div>
          </div>

          <div
            className={`flex h-full flex-col rounded-[10px] border p-2.5 transition-colors duration-500 ${
              locked ? "tx-beam-card tx-beam-line tx-beam-gold border-gold-strong/45 bg-gold-bg" : "border-hairline bg-paper"
            }`}
          >
            <p className="mb-2 flex min-h-[18px] items-center gap-1 font-serif-tc text-[12px] font-bold text-ink">
              市場穩陣 <span className="font-mono-tx text-[10px] font-normal text-ink-3">Market</span>
              {locked ? (
                <span className="ml-auto shrink-0 rounded-[3px] border border-gold-strong/45 bg-gold-bg px-1 font-mono-tx text-[10px] font-bold text-gold">
                  已鎖定
                </span>
              ) : null}
            </p>
            <div className="flex flex-1 flex-col divide-y divide-hairline">
              {marketCol.length ? (
                marketCol.map((p, i) => (
                  <div key={p.horseNumber} className="min-h-[74px] py-2">
                    <div className="grid grid-cols-[16px_24px_minmax(0,1fr)] items-center gap-1.5">
                      <span className="tabnum text-center font-mono-tx text-[11px] font-bold text-ink-3">{i + 1}</span>
                      <span className="tabnum grid h-6 w-6 place-items-center rounded-[4px] border border-gold-strong/45 bg-paper-2 font-mono-tx text-[11px] font-bold text-ink">
                        {p.horseNumber}
                      </span>
                      <div className="min-w-0">
                        {p.horseId ? (
                          <Link to="/horse" search={{ id: p.horseId }} className="block truncate font-serif-tc text-[12px] font-bold text-ink">
                            {p.nameCh}
                          </Link>
                        ) : (
                          <span className="block truncate font-serif-tc text-[12px] font-bold text-ink">{p.nameCh}</span>
                        )}
                        <p className="tabnum mt-0.5 truncate font-mono-tx text-[10px] text-ink-3">檔 {p.draw ?? "—"} · 三甲 {pct(p.pTop3)}</p>
                      </div>
                    </div>
                    <PickStats pWin={p.pWin} od={p.od} />
                  </div>
                ))
              ) : (
                <p className="py-3 text-[11px] leading-relaxed text-ink-3">等臨場盤口，賽日近開賽前自動更新</p>
              )}
            </div>
          </div>
        </div>
  );
}

// 引擎勝算／即時獨贏固定「標籤在上、數字在下」兩欄，避免窄欄時有啲換行、有啲唔換行而一高一低。
function PickStats({ pWin, od }: { pWin: DisplayPick["pWin"]; od: DisplayPick["od"] }) {
  return (
    <div className="mt-1.5 grid grid-cols-2 gap-2 rounded-[4px] bg-paper-2 px-2 py-1.5">
      <div className="min-w-0">
        <span className="block truncate text-[10px] leading-4 text-ink-3">引擎勝算</span>
        <b className="tabnum block font-mono-tx text-[12px] leading-4 text-ink">{pct(pWin)}</b>
      </div>
      <div className="min-w-0 text-right">
        <span className="block truncate text-[10px] leading-4 text-ink-3">即時獨贏</span>
        <b className="tabnum block font-mono-tx text-[12px] leading-4 text-gold">{od != null ? Number(od).toFixed(1) : "—"}</b>
      </div>
    </div>
  );
}
