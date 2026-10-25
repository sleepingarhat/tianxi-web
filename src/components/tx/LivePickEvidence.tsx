import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLockedEvidence } from "@/lib/racing-evidence.functions";
import { LOCKED_FACTORS, parseLockedFactors } from "@/lib/locked-details";
import { Empty, Pill } from "./ui";
import { Button } from '@/components/ui/button';
import { useAuthState } from '@/lib/useAuthState';

export function LivePickEvidence({ raceId, horseId, name, frozen }: { raceId?: string; horseId?: string; name: string; frozen?: boolean }) {
  const read = useServerFn(getLockedEvidence);
  const { userId, signedIn } = useAuthState();
  const q = useQuery({ queryKey: ["live-pick-evidence", userId, raceId, horseId], enabled: signedIn !== null && Boolean(raceId && horseId), staleTime: 300_000,
    queryFn: () => read({ data: { raceId: raceId?.startsWith("race_") ? raceId : `race_${raceId ?? ""}`, horseId: horseId ?? "" } }),
  });
  const number = (value: number | null | undefined) => value == null ? "未記錄" : value.toFixed(1);
  const factors = parseLockedFactors(q.data?.factorScores);
  return <details className="border-b border-hairline py-2">
    <summary className="cursor-pointer text-[12px] font-bold text-ink">{name} <span className="float-right text-[10px] text-gold">解釋資料 ＋</span></summary>
    <div className="mt-2 space-y-2 text-[11px] leading-relaxed text-ink-2">
      <Pill>{q.isLoading ? "核對解釋資料中" : q.error ? "解釋資料讀取未成功" : q.data?.provenance === "public-frozen-picks" ? "公開凍結選馬 · 原欄位" : q.data ? "歷史紀錄 · 鎖點待核" : frozen === false ? "此賽日未鎖定" : "未有可公開紀錄"}</Pill>
      {q.isLoading ? <p>讀取解釋資料…</p> : q.error ? <div><p className="text-ink-3">逐匹解釋暫時未能讀取；四揀預測不受影響。</p><Button variant="outline" size="sm" className="mt-2" onClick={() => q.refetch()}>重讀解釋</Button></div> : q.data ? <>
        <dl className="grid grid-cols-2 gap-2"><div><dt className="text-ink-3">馬匹 Elo</dt><dd className="tabnum font-mono-tx font-bold">{number(q.data.horseElo)}</dd></div><div><dt className="text-ink-3">綜合 Elo</dt><dd className="tabnum font-mono-tx font-bold">{number(q.data.eloComposite)}</dd></div><div><dt className="text-ink-3">因子總分</dt><dd className="tabnum font-mono-tx font-bold">{q.data.factorBonus != null && q.data.factorBonus > 0 ? "+" : ""}{number(q.data.factorBonus)}</dd></div><div><dt className="text-ink-3">紀錄排名</dt><dd className="tabnum font-mono-tx font-bold">第{q.data.rank}選</dd></div></dl>
        <p>{q.data.provenance === "public-frozen-picks" ? "此匹已通過現行公開凍結選馬檢查；數值直接讀原預測紀錄，不補當前模型值。" : "結算只代表賽果可公開，唔證明這行在開跑前發布；缺逐場鎖定憑證，不當成已核實凍結證據。"}</p>
        <dl className="grid grid-cols-2 gap-2"><div><dt className="text-ink-3">騎師 Elo · 原紀錄</dt><dd className="tabnum font-mono-tx">{number(q.data.jockeyElo)}</dd></div><div><dt className="text-ink-3">練馬師 Elo · 原紀錄</dt><dd className="tabnum font-mono-tx">{number(q.data.trainerElo)}</dd></div></dl>
        <div className="grid gap-3 sm:grid-cols-2">
          <section className="min-w-0 border-t border-hairline pt-2"><h4 className="font-bold text-ink">8項因子 · 原紀錄</h4><dl className="mt-2 grid grid-cols-2 gap-2">{LOCKED_FACTORS.map(([key, label]) => <div key={key}><dt className="text-ink-3">{label}{factors?.used.includes(key) ? " · 計入總分" : ""}</dt><dd className="tabnum font-mono-tx">{number(factors?.scores[key])}</dd></div>)}</dl><p className="mt-2 text-ink-3">未保存逐項值則留空，不從總分推算。</p></section>
          <section className="min-w-0 border-t border-hairline pt-2"><h4 className="font-bold text-ink">血統 · 資料庫參考</h4><dl className="mt-2 grid grid-cols-2 gap-2">{[["父系", q.data.sire], ["母系", q.data.dam], ["外祖父", q.data.damsire], ["早熟程度", null]].map(([label, value]) => <div key={label ?? ""}><dt className="text-ink-3">{label}</dt><dd className="break-words font-semibold">{value || (label === "早熟程度" ? "未有核實評估" : "來源未收齊")}</dd></div>)}</dl><p className="mt-2 text-ink-3">未保存逐項凍結血統值；以上名稱只作身份參考，唔代表當日模型輸入。{q.data.pedigreeUpdatedAt ? `來源更新：${q.data.pedigreeUpdatedAt}。` : ""}唔以血統估作自身往績。</p></section>
        </div>
        <p>三軸設定：馬0.7／騎師0.2／練馬師0.1；只讀原紀錄，缺值唔以當前 Elo 或重算因子倒填。</p>
        <p className="break-words text-[10px] text-ink-3">{q.data.modelVersion ?? "模型版本未記錄"} · 記錄時間 {q.data.generatedAt}（非首場T−90時間）</p>
      </> : <div><Empty label={frozen === false ? "此賽日未鎖定，凍結解釋將於鎖點後公開" : "此匹未有可公開凍結解釋紀錄；不使用賽後重算值"} />{frozen === false ? <p className="px-1 text-center text-[10px] leading-relaxed text-ink-3">鎖定前只有初版預測，系統唔會用初版或賽後重算值補寫凍結解釋；到鎖點凍結完成後，此處即會讀到逐匹數值。</p> : null}</div>}
    </div>
  </details>;
}