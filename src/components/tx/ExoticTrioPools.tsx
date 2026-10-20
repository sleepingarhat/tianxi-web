import { useQuery } from "@tanstack/react-query";

import { exoticPoolOptions } from "@/lib/racingPoolAccounting";

import { Card, Pill } from "./ui";

/**
 * 孖T／三T 二拖三：每場引擎凍結頭兩匹做膽，拖第 3、4、5 選。
 * 每場 3 組三重彩組合；孖T 3×3＝9 注、三T 3×3×3＝27 注，每注 $10。
 * 跨場分布直接由官方派彩檔推算：派彩行喺第 R 場、組合有 n 段 → 覆蓋第 R−n+1…R 場。
 * 第 1–5 選優先用凍結排序（predictedFifth.frozen）；舊資料缺欄先退回賽後排序（頁面註明）。
 */
const money = (v: number) => `$${v.toLocaleString("en-US", { maximumFractionDigits: 1 })}`;

export function ExoticTrioPools({ date }: { date: string }) {
  const q = useQuery(exoticPoolOptions(date));
  if (!date) return null;
  const pools = q.data?.pools ?? [];
  const cost = pools.filter((p) => !p.missing).reduce((a, p) => a + p.cost, 0);
  const ret = pools.reduce((a, p) => a + p.payout + p.consPayout, 0);
  const net = ret - cost;

  return (
    <Card title="孖T／三T 二拖三" en="Double Trio · Triple Trio">
      <p className="mb-2 text-[10px] leading-relaxed text-ink-3">
        <b className="text-ink-2">買法：孖T／三T 用引擎凍結預測排序頭 5 隻</b>——每場第 1、2 選做膽，拖第 3、4、5 選，共 3 組；每注 $10。孖T 每口 9 注（$90），兩場都中先算正獎；三T 每口 27 注（$270），三場都中先算正獎，頭兩場中、第三場唔中算安慰獎。
        跨邊幾場以馬會派彩紀錄為準。第 5 選優先用賽前凍結排序；舊賽日未有呢欄就取自賽後排序（該場標示）。同單場四彩池（只用頭 4 選）唔同，孖T／三T 會用到第 5 選。
      </p>
      {q.isLoading ? (
        <p className="py-3 text-center text-[11px] text-ink-3">計算緊…</p>
      ) : q.isError ? (
        <p className="py-3 text-center text-[11px] text-lose">讀取失敗，稍後再試</p>
      ) : !pools.length ? (
        <p className="py-3 text-center text-[11px] text-ink-3">呢個賽日未有孖T／三T 派彩紀錄</p>
      ) : (
        <>
          <div className="mb-2 grid grid-cols-3 gap-2 text-center">
            {[["成本", money(cost), ""], ["派彩", money(ret), ""], ["淨盈虧", `${net >= 0 ? "+" : "−"}${money(Math.abs(net))}`, net >= 0 ? "text-win" : "text-lose"]].map(([l, v, c]) => (
              <div key={l} className="rounded-[6px] border border-hairline bg-paper px-2 py-1.5">
                <p className="text-[9px] text-ink-3">{l}</p>
                <p className={`tabnum font-mono-tx text-[13px] font-bold ${c || "text-ink"}`}>{v}</p>
              </div>
            ))}
          </div>
          <ul>
            {pools.map((p) => (
              <li key={p.name} className="border-b border-hairline py-2 last:border-b-0">
                <p className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <b className="text-ink">{p.name}</b>
                  <span className="text-ink-3">第 {p.races.join("、")} 場</span>
                  <span className="ml-auto">
                    {p.pendingWithdrawal ? <Pill tone="ink">退出待核</Pill> : p.missing ? <Pill tone="ink">缺預測</Pill> : p.mainHit ? <Pill tone="win">中正獎</Pill> : p.consUnits ? <Pill tone="gold">中安慰獎</Pill> : <Pill tone="lose">冇中</Pill>}
                  </span>
                </p>
                <p className="mt-1 flex flex-wrap gap-1 text-[10px]">
                  {p.detail.map((d) => (
                    <span key={d.race} className={`rounded-[4px] border px-1.5 ${d.hit ? "border-win/40 text-win" : d.hit === false ? "border-hairline text-ink-3" : "border-hairline text-ink-3"}`}>
                      R{d.race} {d.hit ? "✓" : d.hit === false ? "✗" : "—"}
                    </span>
                  ))}
                </p>
                 {p.races.some((race) => q.data?.legs[race]?.fifthFromLive) ? (
                   <p className="mt-1 text-[10px] leading-relaxed text-gold">第 {p.races.filter((race) => q.data?.legs[race]?.fifthFromLive).join("、")} 場第 5 選為補選，非賽前凍結；只作試算對照。</p>
                 ) : null}
                <p className="tabnum mt-1 font-mono-tx text-[10px] text-ink-2">
                  {p.units} 注 · 成本 {money(p.cost)}
                  {p.payout ? ` · 正獎 ${money(p.payout)}` : ""}
                  {p.consPayout ? ` · 安慰獎 ${p.consUnits} 注 ${money(p.consPayout)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
