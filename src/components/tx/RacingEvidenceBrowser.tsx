import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getEloDailyLog, getPredictionReconciliation, getReconciliationDates } from "@/lib/racing-reconciliation.functions";
import { Card, Empty, ErrorNote, Loading, Pill, Seg } from "./ui";

const number = (n: number | null | undefined) => n == null ? "未記錄" : n.toFixed(1);
const labels: Record<string, string> = { horse: "馬匹", jockey: "騎師", trainer: "練馬師" };
function download(rows: object[], name: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0] ?? {});
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = '\uFEFF' + [keys.map(escape).join(","), ...rows.map(row => keys.map(k => escape((row as Record<string, unknown>)[k])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}
export function RacingEvidenceBrowser({ mode }: { mode: "prediction" | "elo" }) {
  const readDates = useServerFn(getReconciliationDates);
  const readPredictions = useServerFn(getPredictionReconciliation);
  const readElo = useServerFn(getEloDailyLog);
  const dates = useQuery({ queryKey: ["reconciliation-dates"], queryFn: () => readDates(), staleTime: 300_000 });
  const [selected, setSelected] = useState("");
  const [entity, setEntity] = useState<"horse" | "jockey" | "trainer">("horse");
  const date = selected || dates.data?.days?.[0]?.date || "";
  const predictions = useQuery({ queryKey: ["prediction-reconciliation", date], queryFn: () => readPredictions({ data: { date } }), enabled: mode === "prediction" && Boolean(date), staleTime: 300_000 });
  const elo = useQuery({ queryKey: ["elo-daily-log", date], queryFn: () => readElo({ data: { date } }), enabled: mode === "elo" && Boolean(date), staleTime: 300_000 });
  const q = mode === "prediction" ? predictions : elo;
  const races = [...new Set(predictions.data?.rows.map(r => r.raceNumber) ?? [])];
  const eloRaces = [...new Set(elo.data?.rows.map(r => r.raceNumber) ?? [])].sort((a, b) => (a ?? 99) - (b ?? 99));
  const exportRows = mode === "prediction" ? predictions.data?.rows ?? [] : elo.data?.rows ?? [];
  return <>
    <div className="mx-4 my-4 flex flex-wrap items-center gap-3">
      <label className="text-[12px] font-bold text-ink">賽馬日</label>
      <Select value={date} onValueChange={setSelected}><SelectTrigger aria-label="賽馬日" className="w-44"><SelectValue placeholder="讀取賽馬日" /></SelectTrigger><SelectContent>{dates.data?.days.map(d => <SelectItem value={d.date} key={d.date}>{d.date}</SelectItem>)}</SelectContent></Select>
      <Button variant="outline" size="sm" disabled={!exportRows.length} onClick={() => download(exportRows, `tianxi-${mode}-${date}.csv`)}><Download className="mr-1 size-4" />下載原值 CSV</Button>
    </div>
    {dates.data?.truncated ? <p className="mx-4 mb-2 text-[11px] font-semibold text-gold">讀取上限提示：賽馬日選單只列最近 400 個有賽果嘅賽日，更早賽日未包括。</p> : null}
    {mode === "prediction" ? <p className="mx-4 mb-4 border-l-2 border-gold pl-3 text-[12px] leading-relaxed text-ink-2">以下係有賽果入帳場次嘅原始預測分與官方賽果；不保證全場已完整入帳；舊紀錄未有完整發布憑證，標示「鎖點待核」，不當作已核實賽前準確度。分數與 Elo 高低不代表必然勝出，主指標仍為四揀命中匹數。</p> : <>
      <p className="mx-4 mb-4 border-l-2 border-gold pl-3 text-[12px] leading-relaxed text-ink-2">真正 v12 評分快照，顯示前後原值及淨變動；來源場次以馬匹往績與官方賽果交叉配對。淨變動可能包含馬季回歸，唔等同純賽事加減分；補計不是原賽前輸入，首個快照無前值就保持未記錄。</p>
      <div className="mx-4 mb-4"><Seg value={entity} onChange={setEntity} options={[{ value: "horse", label: "馬匹" }, { value: "jockey", label: "騎師" }, { value: "trainer", label: "練馬師" }]} /></div>
    </>}
    {dates.error ? <ErrorNote error={dates.error} /> : dates.isLoading || q.isLoading ? <Loading /> : q.error ? <ErrorNote error={q.error} /> : !exportRows.length ? <Empty label="此日未有可公開核對紀錄；不使用即時計算補上。" /> : mode === "prediction" ? races.map(raceNumber => {
      const rows = predictions.data?.rows.filter(r => r.raceNumber === raceNumber) ?? [];
      const picks = rows.filter(r => r.rank != null && r.rank >= 1 && r.rank <= 4);
      const complete = picks.length === 4 && new Set(picks.map(r => r.rank)).size === 4 && rows.every(r => r.rank != null && r.finish != null && (r.predictionHorseNumber == null || r.predictionHorseNumber === r.horseNumber));
      const hit = picks.filter(r => r.finish != null && r.finish >= 1 && r.finish <= 4).length;
      return <Card key={raceNumber} title={`第 ${raceNumber} 場 · ${rows[0]?.venue === "HV" ? "跑馬地" : "沙田"}`} action={<Pill tone="gold">{complete ? `紀錄四揀中 ${hit}／4` : "對帳未完整"}</Pill>}>
        <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-[11px]"><thead className="text-ink-3"><tr>{["預測次序", "馬匹", "預測分", "馬匹 Elo", "綜合 Elo", "實際名次", "證據"].map(t => <th key={t} className="pb-2 pr-3 font-medium">{t}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.horseId} className="border-t border-hairline text-ink"><td className="py-3">{row.rank ?? "未記錄"}</td><td className="pr-3 font-bold">{row.horseNumber} {row.name}</td><td className="tabnum">{number(row.score)}</td><td className="tabnum">{number(row.horseElo)}</td><td className="tabnum">{number(row.composite)}</td><td className={row.finish != null && row.finish <= 4 ? "font-bold text-win" : ""}>{row.finish === 999 ? "未完成" : row.finish ?? "未入帳"}</td><td className="text-ink-3">{row.timing === "post_race" ? "賽後生成" : row.timing === "missing" ? "缺預測" : "鎖點待核"}</td></tr>)}</tbody></table></div>
        <div className="divide-y divide-hairline md:hidden">{rows.map(row => <article key={row.horseId} className="py-3"><div className="flex items-start justify-between gap-3"><h3 className="min-w-0 font-bold text-ink">{row.horseNumber} {row.name}</h3><span className="shrink-0 font-bold text-win">{row.finish === 999 ? "未完成" : row.finish ? `第 ${row.finish} 名` : "未入帳"}</span></div><dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]"><div><dt className="text-ink-3">預測次序／分</dt><dd className="tabnum text-ink">{row.rank ?? "—"}／{number(row.score)}</dd></div><div><dt className="text-ink-3">馬匹 Elo</dt><dd className="tabnum text-ink">{number(row.horseElo)}</dd></div><div><dt className="text-ink-3">綜合 Elo</dt><dd className="tabnum text-ink">{number(row.composite)}</dd></div></dl><p className="mt-2 text-[10px] text-ink-3">{row.timing === "post_race" ? "賽後生成" : row.timing === "missing" ? "缺預測" : "鎖點待核"} · {row.version ?? "版本未記錄"}</p></article>)}</div>
        <details className="mt-3 text-[11px] text-ink-3"><summary className="cursor-pointer">原始模型分、騎練及記錄時間</summary>{rows.map(row => <p className="mt-2 break-words" key={row.horseId}>{row.name} · LGB {number(row.lgb)} · 騎師 {number(row.jockeyElo)} · 練馬師 {number(row.trainerElo)} · {row.generatedAt ?? "時間未記錄"} · {row.source ?? "來源未記錄"}{row.loggedFinish != null && row.finish !== row.loggedFinish ? " · 賽果對帳不一致" : ""}{row.predictionHorseNumber != null && row.predictionHorseNumber !== row.horseNumber ? " · 馬號不一致" : ""}</p>)}</details>
      </Card>;
    }) : eloRaces.map(race => {
      const rows = elo.data?.rows.filter(r => r.raceNumber === race && r.entityType === entity) ?? [];
      if (!rows.length) return null;
      return <Card key={race ?? "unmapped"} title={race == null ? "官方場次未能唯一配對" : `第 ${race} 場 · ${labels[entity]}評分更新`}>
        <div className="divide-y divide-hairline">{rows.map(row => <article key={row.id} className="py-3"><div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"><h3 className="font-bold text-ink">{row.name || row.entityId}</h3><span className={`tabnum font-mono-tx font-bold ${row.delta != null && row.delta > 0 ? "text-win" : row.delta != null && row.delta < 0 ? "text-lose" : "text-ink-3"}`}>{row.delta == null ? "前值未記錄" : `${row.delta > 0 ? "+" : ""}${row.delta.toFixed(2)}`}</span></div><p className="mt-1 tabnum text-[12px] text-ink-2">{number(row.before)} → {number(row.rating)}{row.season ? " · 原快照馬季標記（不證明此次回歸）" : ""}</p><details className="mt-1 text-[10px] text-ink-3"><summary className="cursor-pointer">來源快照</summary><p className="mt-1 break-all">{row.id} · 計算 {row.computedAt}</p></details></article>)}</div>
      </Card>;
    })}
  </>;
}
