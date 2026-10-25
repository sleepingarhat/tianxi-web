import { useServerFn } from "@tanstack/react-start";
import { getPositionHistory } from "@/lib/racing-reconciliation.functions";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { actualStages, historicalPositions, type PositionForm } from "@/lib/racing-visibility";
import { txApi } from "@/lib/tx-api";
import { Card, Empty, ErrorNote, Loading, Pill, Seg, Silks } from "./ui";

type Runner = { horseId?: string; id?: string; horseNumber: number; nameCh?: string; rank?: number; pWin?: number };
export function RacePositionMap({ date, raceId, distance, picks, frozen }: { date: string; raceId?: string; distance: number; picks: Runner[]; frozen: boolean }) {
  const readHistory = useServerFn(getPositionHistory);
  const [scope, setScope] = useState<"picks" | "all">("picks");
  const canonicalId = raceId ? (raceId.startsWith("race_") ? raceId : `race_${raceId}`) : undefined;
  const result = useQuery({ queryKey: ["race-position-result", canonicalId], enabled: Boolean(canonicalId), staleTime: 60_000, refetchInterval: 300_000,
    // 賽事紀錄尚未開放（404）唔係資料錯誤，視為「賽果未入帳」；其他錯誤照常顯示
    queryFn: async () => {
      try {
        return await txApi.race(canonicalId ?? "");
      } catch (e) {
        if (/API 404/.test(String((e as Error)?.message ?? ""))) return null;
        throw e;
      }
    },
  });
  const actual: { horseNumber: number; runningPosition?: string; finishingPosition?: number }[] = result.data?.horses ?? [];
  const settled = actual.length > 0 && actual.every(p => Number(p.finishingPosition) > 0);
  const partialResults = !settled && actual.some(p => Number(p.finishingPosition) > 0);
  const ids = picks.map(p => p.horseId ?? "").join(",");
  const q = useQuery({ queryKey: ["historical-position-map", date, raceId, distance, ids], staleTime: 300_000,
    queryFn: async () => {
      const entries = canonicalId ? await txApi.raceEntries(canonicalId).catch(() => null) : null;
      const all: Runner[] = Array.isArray(entries?.entries) ? entries.entries : Array.isArray(entries?.horses) ? entries.horses : picks;
      const runners = all.map(p => ({ ...p, horseId: p.horseId ?? p.id })).filter(p => p.horseId);
      const output = [];
      for (let i = 0; i < runners.length; i += 4) {
        output.push(...await Promise.all(runners.slice(i, i + 4).map(async p => {
          const form = await readHistory({ data: { horseId: p.horseId ?? "", date } }).catch(() => null);
          const history: PositionForm[] = form ?? [];
          return { ...p, failed: !form, summary: historicalPositions(history, date, distance), pick: picks.find(x => x.horseNumber === p.horseNumber) };
        })));
      }
      return output.sort((a, b) => (a.summary.stages[0]?.mid ?? Infinity) - (b.summary.stages[0]?.mid ?? Infinity));
    }, enabled: Boolean(date && picks.length),
  });
  const rows = (q.data ?? []).filter(p => scope === "all" || (p.pick?.rank != null && p.pick.rank <= 4));
  const ordered = scope === "picks" ? rows.slice().sort((a, b) => (a.pick?.rank ?? 99) - (b.pick?.rank ?? 99)) : rows;
  return <Card title="馬匹走位對照" en="Running positions" action={<Pill tone={settled ? "win" : "ink"}>{settled ? "已有賽果" : partialResults ? "部分賽果已入帳" : "賽果待更新"}</Pill>}>
    <div className="mb-3"><Seg value={scope} onChange={setScope} options={[{ value: "picks", label: frozen ? "凍結四揀" : "本場四揀" }, { value: "all", label: "全場馬匹" }]} /></div>
    <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 border-b border-hairline pb-2 text-[10px] leading-relaxed text-ink-2">
      <span><b className="text-gold">前</b> 賽前歷史參考（約）</span><span><b className="text-win">後</b> 今場實際走位</span><span><b className="text-ink">終點</b> 最終名次</span><span className="text-ink-3">數字越細越近領放</span>
    </div>
    {result.error ? <ErrorNote error={result.error} /> : !settled ? <p className="mb-3 border-l-2 border-hairline pl-2 text-[11px] text-ink-3">{result.isLoading ? "正在讀取當場賽果…" : "當場走位及終點名次尚未入帳。"}</p> : null}
    {q.isLoading ? <Loading /> : q.error ? <ErrorNote error={q.error} /> : ordered.length ? <div className="divide-y divide-hairline">
      {ordered.map(p => {
        const runner = actual.find(a => a.horseNumber === p.horseNumber);
        const stages = actualStages(runner?.runningPosition);
        const finish = Number(runner?.finishingPosition);
        const hasFinish = Number.isFinite(finish) && finish > 0;
        const selected = p.pick?.rank != null && p.pick.rank <= 4;
        return <article key={p.horseId} className="py-3 first:pt-0 last:pb-0">
          <header className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div className="flex min-w-0 items-center gap-2"><Silks source={{ horseId: p.horseId ?? null }} size={28} /><span className="tabnum grid h-6 w-6 shrink-0 place-items-center rounded-[4px] bg-deep font-mono-tx text-[12px] font-bold text-deep-fg">{p.horseNumber}</span><div className="min-w-0"><h3 className="truncate text-[13px] font-bold text-ink">{p.nameCh || p.pick?.nameCh || "馬名未提供"}</h3>{selected ? <p className="text-[10px] font-bold text-gold">{frozen ? "凍結" : "初版"}第{p.pick?.rank}選</p> : null}</div></div>
            <div className={`shrink-0 rounded-[6px] border px-2.5 py-1 text-center ${hasFinish && finish <= 4 ? "border-win/40 bg-win/10" : "border-hairline bg-paper-2"}`}><p className="text-[9px] text-ink-3">終點</p><p className={`tabnum font-mono-tx text-[15px] font-bold leading-tight ${hasFinish && finish <= 4 ? "text-win" : "text-ink-2"}`}>{hasFinish ? `第${finish}名` : "—"}</p></div>
          </header>
          <div className="grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map(i => {
              const h = p.failed ? null : p.summary.stages[i]?.mid; const a = stages?.[i];
              const d = h != null && a != null ? a - h : null;
              return <div key={i} className="min-w-0 rounded-[6px] border border-hairline bg-paper px-1.5 py-1.5 text-center">
                <p className="mb-1 text-[10px] font-bold text-ink-3">{["早段", "中段", "末段"][i]}</p>
                <p className="tabnum font-mono-tx text-[11px] text-gold"><span className="text-[9px] text-ink-3">前 </span>{h == null ? "—" : `約${Number(h.toFixed(1))}`}</p>
                <p className={`tabnum font-mono-tx text-[13px] font-bold ${a != null ? "text-win" : "text-ink-3"}`}><span className="text-[9px] font-normal text-ink-3">後 </span>{a != null ? `第${a}` : "—"}</p>
                {d != null ? <p className={`text-[9px] font-bold ${d < -0.5 ? "text-win" : d > 0.5 ? "text-lose" : "text-ink-3"}`}>{d < -0.5 ? `▲ 前${Number((-d).toFixed(1))}位` : d > 0.5 ? `▼ 後${Number(d.toFixed(1))}位` : "≈ 同平時"}</p> : null}
              </div>;
            })}
          </div>
          <p className="mt-1.5 text-[10px] text-ink-3">{p.failed ? "歷史讀取失敗" : p.summary.n === 0 ? "未有可用嘅香港正式賽事走位紀錄（試閘不計入）" : `歷史樣本 ${p.summary.n} 仗 · ${p.summary.sameBand ? "同途程組" : "跨途程"}`}</p>
          <details className="mt-2 text-[10px] leading-relaxed text-ink-3"><summary className="cursor-pointer">原始走位及歷史範圍</summary><p className="mt-2 break-words">當場完整走位：{runner?.runningPosition || "未有資料"}；最後一個數字為終點，不計入上方走位。</p><p>{p.failed ? "歷史範圍未能讀取，唔當成零樣本。" : `歷史中間50%範圍：${p.summary.stages.map((s, i) => `${["早段", "中段", "末段"][i]} ${s.low == null ? "無資料" : `${Number(s.low.toFixed(1))}–${Number(s.high?.toFixed(1))}位`}`).join(" · ")}`}</p></details>
        </article>;
      })}
    </div> : <Empty label={scope === "picks" ? "未有四揀走位資料" : "未有馬匹走位資料"} />}
    <details className="mt-4 border-t border-hairline pt-3 text-[10px] leading-relaxed text-ink-3"><summary className="cursor-pointer">資料來源與限制</summary><p className="mt-2">歷史參考只用 {date} 前近8仗，優先同途程組；「約」為過往位置中位數，唔係今場名次估算。早、中、末段取自走位記錄嘅相對段落，唔係固定米數；不同场次馬數可能不同。</p><p className="mt-1">當場賽果每5分鐘更新。現有接口未提供T−90走位快照，唔計凍結估測誤差；四揀鎖定狀態只指選馬，唔代表上方歷史走位已鎖定。</p></details>
  </Card>;
}