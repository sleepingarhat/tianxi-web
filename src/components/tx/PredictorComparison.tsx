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
              天喜預測 <span className="font-mono-tx text-[9px] font-normal text-ink-3">TIANXI</span>
              {locked ? (
                <span className="ml-auto shrink-0 rounded-[3px] border border-win/45 bg-win/10 px-1 font-mono-tx text-[8px] font-bold text-win">
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
                      <span className="tabnum grid h-6 w-6 place-items-center rounded-[4px] border border-gold-strong/45 bg-paper-2 font-mono-tx text-[10px] font-bold text-ink">
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
                        <p className="tabnum mt-0.5 truncate font-mono-tx text-[9px] text-ink-3">檔 {p.draw ?? "—"} · 三甲 {pct(p.pTop3)}</p>
                        {p.officialChange ? (
                          <Link to="/race-changes" className="mt-1 block">
                            <Pill tone="lose">
                              {p.officialChange.kind === "replaced" ? `已退出・由${p.officialChange.replacement}補上` : "已退出"}
                            </Pill>
                            <span className="mt-0.5 block font-mono-tx text-[8px] text-lose">
                              馬會 {p.officialChange.announcedAt} 公布{p.officialChange.beforeLock ? "（鎖定前）" : ""}
                            </span>
                          </Link>
                        ) : null}
                        {sub.added.includes(p.horseNumber) ? (
                          <span className="mt-1 block"><Pill tone="win">按引擎順位補上四揀</Pill></span>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-[4px] bg-paper-2 px-1.5 py-1">
                      <span className="text-[8px] text-ink-3">引擎勝算 <b className="tabnum ml-0.5 font-mono-tx text-[10px] text-ink">{pct(p.pWin)}</b></span>
                      <span className="text-right text-[8px] text-ink-3">即時獨贏 <b className="tabnum ml-0.5 font-mono-tx text-[10px] text-gold">{p.od != null ? Number(p.od).toFixed(1) : "—"}</b></span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-3 text-[10px] text-ink-3">此場整備中</p>
              )}
            </div>
            {sub.substituted ? (
              <p className="mt-2 rounded-[4px] border border-win/40 bg-win/[0.06] px-1.5 py-1 font-mono-tx text-[9px] text-ink">
                有效四揀 {sub.effective.join("-")}
                <span className="block text-ink-3">原凍結 {sub.original.join("-")}，退出馬匹由引擎下一順位補上</span>
              </p>
            ) : null}
          </div>

          <div
            className={`flex h-full flex-col rounded-[10px] border p-2.5 transition-colors duration-500 ${
              locked ? "tx-beam-card tx-beam-line tx-beam-gold border-gold-strong/45 bg-gold-bg" : "border-hairline bg-paper"
            }`}
          >
            <p className="mb-2 flex min-h-[18px] items-center gap-1 font-serif-tc text-[12px] font-bold text-ink">
              市場穩陣 <span className="font-mono-tx text-[9px] font-normal text-ink-3">MARKET</span>
              {locked ? (
                <span className="ml-auto shrink-0 rounded-[3px] border border-gold-strong/45 bg-gold-bg px-1 font-mono-tx text-[8px] font-bold text-gold">
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
                      <span className="tabnum grid h-6 w-6 place-items-center rounded-[4px] border border-gold-strong/45 bg-paper-2 font-mono-tx text-[10px] font-bold text-ink">
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
                        <p className="tabnum mt-0.5 truncate font-mono-tx text-[9px] text-ink-3">檔 {p.draw ?? "—"} · 三甲 {pct(p.pTop3)}</p>
                      </div>
                    </div>
                    <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-[4px] bg-paper-2 px-1.5 py-1">
                      <span className="text-[8px] text-ink-3">引擎勝算 <b className="tabnum ml-0.5 font-mono-tx text-[10px] text-ink">{pct(p.pWin)}</b></span>
                      <span className="text-right text-[8px] text-ink-3">即時獨贏 <b className="tabnum ml-0.5 font-mono-tx text-[10px] text-gold">{p.od != null ? Number(p.od).toFixed(1) : "—"}</b></span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-3 text-[10px] leading-relaxed text-ink-3">等臨場盤口，賽日近開賽前自動更新</p>
              )}
            </div>
          </div>
        </div>
  );
}
