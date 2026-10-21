import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

import { exoticPoolOptions } from "@/lib/racingPoolAccounting";

import { Card, Pill } from "./ui";

/**
 * 孖T／三T 二拖三：每場引擎凍結頭兩匹做膽，拖第 3、4、5 選。
 * 每場 3 組三重彩組合；孖T 3×3＝9 注、三T 3×3×3＝27 注，每注 $10。
 * 跨場分布直接由官方派彩檔推算：派彩行喺第 R 場、組合有 n 段 → 覆蓋第 R−n+1…R 場。
 * 第 1–5 選只用已核實原始副本；缺第五選或鎖前無效輸入不結算。
 */
const money = (v: number) => `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export function ExoticTrioPools({ date, detailed = false }: { date: string; detailed?: boolean }) {
  const q = useQuery(exoticPoolOptions(date));
  if (!date) return null;
  const pools = q.data?.pools ?? [];
  const cost = pools.filter((p) => !p.missing).reduce((a, p) => a + p.cost, 0);
  const ret = pools.reduce((a, p) => a + p.payout + p.consPayout, 0);
  const net = ret - cost;

  return (
    <Card title="孖T／三T 二拖三" en="Double Trio · Triple Trio">
      <p className="mb-3 text-[12px] font-bold text-gold">孖T／三T跨場組口盈虧由 19/10/2026 起計；之前賽日不計跨場組口。</p>
      <p className="mb-2 text-[10px] leading-relaxed text-ink-3">
        <b className="text-ink-2">買法：孖T／三T 用引擎凍結預測排序頭 5 隻</b>——每場第 1、2 選做膽，拖第 3、4、5 選，共 3 組；每注 $10。孖T 每口 9 注（$90），兩場都中先算正獎；三T 每口 27 注（$270），三場都中先算正獎，頭兩場中、第三場唔中算安慰獎。
        跨邊幾場以馬會派彩紀錄為準。第 5 選只用已核實原凍結；缺第五選或鎖前無效輸入不入正式合計。孖T／三T 會用到第 5 選。
      </p>
      {q.isLoading ? (
        <p className="py-3 text-center text-[11px] text-ink-3">計算緊…</p>
      ) : q.isError ? (
        <div className="py-3 text-center text-[11px] text-lose"><p>讀取失敗，稍後再試</p><Button variant="outline" size="sm" className="mt-2" onClick={() => q.refetch()}>重新核對</Button></div>
      ) : q.data?.noArchive ? (
        <p className="py-3 text-center text-[11px] leading-relaxed text-ink-3">呢個賽日未建立原始凍結存證，孖T／三T 唔作結算，亦唔計入累計盈虧。</p>
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
          {pools.some(p => p.missing) ? <p className="mb-2 text-[11px] text-gold">合計只含已核實組口；待核組口成本及派彩未納入。</p> : null}
          <ul>
            {pools.map((p) => (
              <li key={`${p.name}:${p.races.join("-")}`} className="border-b border-hairline py-2 last:border-b-0">
                <p className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <b className="text-ink">{p.name}</b>
                  <span className="text-ink-3">第 {p.races.join("、")} 場</span>
                  <span className="ml-auto">
                    {p.pendingWithdrawal ? <Pill tone="ink">退出待核</Pill> : p.pendingSettlement ? <Pill tone="ink">結算待核</Pill> : p.missing ? <Pill tone="ink">缺預測</Pill> : p.mainHit ? <Pill tone="win">中正獎</Pill> : p.consUnits ? <Pill tone="gold">中安慰獎</Pill> : <Pill tone="lose">冇中</Pill>}
                  </span>
                </p>
                {detailed ? <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {p.detail.map(d => <div key={d.race} className="min-w-0 border-l-2 border-hairline pl-3 text-[11px] leading-relaxed">
                    <p className="flex items-center gap-2"><b>第 {d.race} 場</b><Pill tone={d.hit === true ? "win" : "ink"}>{d.hit === true ? "命中" : d.hit === false ? "未中" : "待核"}</Pill></p>
                    <p className="mt-1 text-ink-2">原凍結：膽 {d.original?.bankers.join("、") ?? "—"} ／ 拖 {d.original?.legs.join("、") ?? "—"}</p>
                    <p className="text-ink-2">結算注項：{d.settledCombinations?.map(t => t.join("、")).join(" ／ ") ?? "待核"}</p>
                    <p className="text-ink-3">官方正獎組合：{d.winningCombination ?? "未有紀錄"}</p>
                  </div>)}
                </div> : <p className="mt-1 flex flex-wrap gap-1 text-[10px]">
                  {p.detail.map((d) => (
                    <span key={d.race} className={`rounded-[4px] border px-1.5 ${d.hit ? "border-win/40 text-win" : d.hit === false ? "border-hairline text-ink-3" : "border-hairline text-ink-3"}`}>
                      R{d.race} {d.hit ? "✓" : d.hit === false ? "✗" : "—"}
                    </span>
                  ))}
                </p>}
                {detailed ? <p className="mt-3 text-[11px] leading-relaxed text-ink-3">第 {p.races.at(-1)} 場結算 · 官方每 $10 正獎派彩 {p.mainDividend == null ? "—" : money(p.mainDividend)}{p.consolationDividend == null ? "" : ` · 安慰獎 ${money(p.consolationDividend)}`} · 派彩屬整口跨場投注，唔拆成單場收益。</p> : null}
                {p.races.map(race => { const source=q.data?.evidence[race]?.source; return source ? <p key={race} className="mt-1 break-all text-[10px] text-ink-3"><a className="text-gold underline" href={source.sourceUrl} target="_blank" rel="noreferrer">R{race} 官方熱門存檔</a> · SHA {source.sha256}</p> : null; })}
                <p className="tabnum mt-1 font-mono-tx text-[10px] text-ink-2">
                  {p.missing ? '成本及派彩待核，不入合計' : `${p.units} 注 · 成本 ${money(p.cost)}`}
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
