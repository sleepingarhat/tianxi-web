import { queryOptions, useQuery } from "@tanstack/react-query";

import { fetchRaceDividends } from "@/lib/raceDividends";
import { SINGLE_POOLS, singlePoolKey, winningSingleDividends } from "@/lib/racingPoolAccounting";
import { getMeetingHitRate } from "@/lib/hit-rate.functions";
import { useAuthState } from "@/lib/useAuthState";

import { Card, Pill } from "./ui";
import { RedactedNote } from "./RedactedNote";

/** 單場四彩池逐場核對：模型首 4 複式，每場派彩以馬會官方派彩檔為準。 */
type Row = { race: number; top4: number[]; actual: number[]; pools: Record<string, number>; redacted?: boolean };

export const singlePoolDayOptions = (date: string, viewer: string | null = null) => queryOptions({
  queryKey: ["single-pool-day", viewer, date], enabled: !!date, staleTime: 10 * 60_000,
  queryFn: async (): Promise<Row[]> => {
    const [hr, divs] = await Promise.all([
      getMeetingHitRate({ data: { date } }),
      fetchRaceDividends(date),
    ]);
    return (hr?.races ?? []).map((r: any) => {
      // 訪客隱藏場次：只有賽果，唔計入命中／派彩統計（唔當冇中）。
      if (r.redacted) return { race: Number(r.raceNumber), top4: [], actual: (r.actualTop4 ?? []).map((h: any) => Number(h.horseNumber)), pools: {}, redacted: true };
      const top4 = (r.predictedTop4 ?? []).map((h: any) => Number(h.horseNumber)).filter(Number.isFinite);
      const actual = (r.actualTop4 ?? []).map((h: any) => Number(h.horseNumber));
      const pools: Record<string, number> = {};
      for (const d of winningSingleDividends(divs.filter((x) => x.race_no === Number(r.raceNumber)), top4)) {
        const k = singlePoolKey(d.pool)!; pools[k] = (pools[k] ?? 0) + d.dividend;
      }
      return { race: Number(r.raceNumber), top4, actual, pools };
    }).filter((r: Row) => r.redacted || r.top4.length === 4).sort((a: Row, b: Row) => a.race - b.race);
  },
});

const money = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;

export function SinglePoolDaily({ date }: { date: string }) {
  const { userId } = useAuthState();
  const q = useQuery(singlePoolDayOptions(date, userId));
  const all = q.data ?? [];
  const rows = all.filter((r) => !r.redacted);
  const hidden = all.filter((r) => r.redacted);
  const tot = SINGLE_POOLS.map((p) => {
    const payout = rows.reduce((a, r) => a + (r.pools[p.key] ?? 0), 0);
    const hits = rows.filter((r) => r.pools[p.key]).length;
    return { ...p, cost: p.cost * rows.length, payout, hits };
  });
  return (
    <Card title="四連環／單T／三重彩／四重彩" en="Single-race pools">
      <p className="mb-2 text-[10px] leading-relaxed text-ink-3">
        <b className="text-ink-2">買法：四個單場彩池全部用引擎凍結預測排序頭 4 隻做複式</b>（4 匹之間名次次序不限）：四連環 1 注 $10（4 匹全部跑入前四）、單T 4 注 $40（頭三名全部喺 4 匹之內）、三重彩 24 注 $240（頭三名按次序全部喺 4 匹之內）、四重彩 24 注 $240（頭四名按次序全部係呢 4 匹）。每注 $10，派彩以馬會官方派彩紀錄為準；引擎預測嘅第 5 選唔計入單場彩池（孖T／三T 先會用到頭 5 選，見下面嗰格）。
      </p>
      {q.isLoading ? <p className="py-3 text-center text-[11px] text-ink-3">計算緊…</p>
        : q.isError ? <p className="py-3 text-center text-[11px] text-lose">讀取失敗，稍後再試</p>
        : !rows.length ? <p className="py-3 text-center text-[11px] text-ink-3">呢個賽日未有賽果</p>
        : (
          <>
            <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {tot.map((t) => { const net = t.payout - t.cost; return (
                <div key={t.key} className="rounded-[6px] border border-hairline bg-paper px-2 py-1.5">
                  <p className="text-[10px] text-ink-3">{t.name} · 中 {t.hits}/{rows.length}</p>
                  <p className={`tabnum font-mono-tx text-[13px] font-bold ${net >= 0 ? "text-win" : "text-lose"}`}>{net >= 0 ? "+" : "−"}{money(Math.abs(net))}</p>
                  <p className="tabnum font-mono-tx text-[9px] text-ink-3">成本 {money(t.cost)} · 派彩 {money(t.payout)}</p>
                </div>); })}
            </div>
            <ul>
              {rows.map((r) => (
                <li key={r.race} className="border-b border-hairline py-2 last:border-b-0">
                  <p className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <b className="text-ink">第 {r.race} 場</b>
                    <span className="tabnum font-mono-tx text-ink-2">四揀 {r.top4.join("-")}</span>
                    <span className="tabnum font-mono-tx text-ink-3">賽果 {r.actual.join("-") || "—"}</span>
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1 text-[10px]">
                    {SINGLE_POOLS.map((p) => r.pools[p.key]
                      ? <Pill key={p.key} tone="win">{p.name} ✓ {money(r.pools[p.key] ?? 0)}</Pill>
                      : <span key={p.key} className="rounded-[4px] border border-hairline px-1.5 text-ink-3">{p.name} ✗</span>)}
                  </p>
                </li>
              ))}
            </ul>
            {hidden.length ? <RedactedNote races={hidden.map((r) => ({ race: r.race, actual: r.actual }))} /> : null}
          </>
        )}
    </Card>
  );
}
