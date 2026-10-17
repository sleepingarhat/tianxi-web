import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLockedEvidence } from "@/lib/racing-evidence.functions";
import { Empty, Pill } from "./ui";

export function LivePickEvidence({ raceId, horseId, name }: { raceId?: string; horseId?: string; name: string }) {
  const read = useServerFn(getLockedEvidence);
  const q = useQuery({ queryKey: ["live-pick-evidence", raceId, horseId], enabled: Boolean(raceId && horseId), staleTime: 300_000,
    queryFn: () => read({ data: { raceId: raceId?.startsWith("race_") ? raceId : `race_${raceId ?? ""}`, horseId: horseId ?? "" } }),
  });
  const number = (value: number | null | undefined) => value == null ? "未記錄" : value.toFixed(1);
  return <details className="border-b border-hairline py-2">
    <summary className="cursor-pointer text-[12px] font-bold text-ink">{name} <span className="float-right text-[10px] text-gold">解釋資料 ＋</span></summary>
    <div className="mt-2 space-y-2 text-[11px] leading-relaxed text-ink-2">
      <Pill>{q.data?.provenance === "public-frozen-picks" ? "公開凍結選馬 · 原欄位" : q.data ? "歷史紀錄 · 鎖點待核" : "未有可公開紀錄"}</Pill>
      {q.isLoading ? <p>讀取解釋資料…</p> : q.error ? <p className="text-lose">逐匹解釋暫時未能讀取；凍結四揀不受影響。</p> : q.data ? <>
        <dl className="grid grid-cols-2 gap-2"><div><dt className="text-ink-3">馬匹 Elo</dt><dd className="tabnum font-mono-tx font-bold">{number(q.data.horseElo)}</dd></div><div><dt className="text-ink-3">綜合 Elo</dt><dd className="tabnum font-mono-tx font-bold">{number(q.data.eloComposite)}</dd></div><div><dt className="text-ink-3">因子總分</dt><dd className="tabnum font-mono-tx font-bold">{q.data.factorBonus != null && q.data.factorBonus > 0 ? "+" : ""}{number(q.data.factorBonus)}</dd></div><div><dt className="text-ink-3">紀錄排名</dt><dd className="tabnum font-mono-tx font-bold">第{q.data.rank}選</dd></div></dl>
        <p>{q.data.provenance === "public-frozen-picks" ? "此匹已通過現行公開凍結選馬檢查；數值直接讀原預測紀錄，不補當前模型值。" : "結算只代表賽果可公開，唔證明這行在開跑前發布；缺逐場鎖定憑證，不當成已核實凍結證據。"}</p>
        <p>三軸設定：馬0.7／騎師0.2／練馬師0.1；歷史紀錄只保存馬匹與綜合值，未保存騎師、練馬師及檔位／負磅逐項拆分，唔以當前值倒填。</p>
        <p className="break-words text-[10px] text-ink-3">{q.data.modelVersion ?? "模型版本未記錄"} · 記錄時間 {q.data.generatedAt}（非首場T−90時間）</p>
      </> : <Empty label="此匹未有可公開凍結解釋紀錄；不使用賽後重算值" />}
    </div>
  </details>;
}