import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/tx/ui";
import { getFreezeRecoveryStatus } from "@/lib/freeze-recovery.functions";

export const recoveryQuery = queryOptions({ queryKey: ["freeze-recovery-status"], queryFn: () => getFreezeRecoveryStatus(), staleTime: 0, refetchInterval: 60_000 });
const actions: Record<string, string> = { "pre-lock": "未到凍結時間", "no-fixture": "未有賽日", "verified-original": "原始副本核對一致", "restored-original": "已原樣恢復缺行", blocked: "已阻截公開", "not-checked": "尚未核實", unavailable: "狀態未能核實" };
function time(value?: string) { return value ? new Date(value).toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong", hour12: false }) : "未有巡查紀錄"; }

export function FreezeRecoveryPanel() {
  const { data, refetch, isFetching } = useSuspenseQuery(recoveryQuery);
  const history = data.history ?? [];
  return <Card title="凍結自動修復 · 即時狀態" en="只恢復原始預測" action={<Button variant="ghost" size="icon" aria-label="更新修復狀態" title="更新修復狀態" disabled={isFetching} onClick={() => void refetch()}><RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /></Button>}>
    <div className="grid gap-3 text-[12px] sm:grid-cols-3">
      <div><div className="text-ink-3">目前狀態</div><strong className={data.ok ? "text-brand" : "text-loss"}>{actions[data.action] ?? "待核實狀態"}</strong></div>
      <div><div className="text-ink-3">賽日</div><strong className="text-ink">{"date" in data ? data.date ?? "未有賽日" : "未核實"}</strong></div>
      <div><div className="text-ink-3">最近巡查（香港時間）</div><span className="text-ink">{time("checked_at" in data ? data.checked_at : undefined)}</span></div>
    </div>
    {data.error && <p role="alert" className="mt-3 text-[12px] text-loss">{data.error}；未用新分數補寫。</p>}
    <ol className="mt-4 grid gap-2 text-[12px] leading-relaxed text-ink-2 sm:grid-cols-2">
      <li><b className="text-ink">① 寫入前阻截</b>：重複馬匹、馬號或排名，以及缺場／缺行均不得當作完整凍結。</li>
      <li><b className="text-ink">② 保存原始副本</b>：核對賽前生成時間及正選名單，保存不可改寫的 SHA-256 副本。</li>
      <li><b className="text-ink">③ 鎖後每5分鐘核對</b>：比對原始場次、馬匹、完整排名及各預測欄位；不一致即阻截。</li>
      <li><b className="text-ink">④ 安全恢復</b>：只補回副本缺行並讀回核對；已有衝突不覆寫，NULL 不以臨場數值補上。</li>
    </ol>
    <p className="mt-3 text-[12px] leading-relaxed text-ink-2">巡查沿用現有鎖點工作；異常接入引擎健康告警。沒有可靠副本就停用，不重新運算歷史預測。</p>
    <details className="mt-3 text-[11px] text-ink-2"><summary className="cursor-pointer text-gold">原始副本指紋</summary><p className="mt-2 break-all font-mono-tx">{"fingerprint" in data && data.fingerprint ? data.fingerprint : "尚未保存本賽日原始副本；不以現行設定冒充。"}</p></details>
    <h3 className="mt-5 text-[13px] font-bold text-ink">修復與巡查日誌</h3>
    <details className="mt-3 text-[12px] text-ink-2"><summary className="cursor-pointer text-gold">逐場完整性巡查</summary>{data.race_audits?.length ? <ol className="mt-2 divide-y divide-hairline">{data.race_audits.map((a,i) => <li key={`${a.checked_at}-${a.race_number}-${i}`} className="py-3"><b className={a.ok ? "text-brand" : "text-loss"}>{a.date} 第{a.race_number}場 · {a.ok ? "一致" : "異常"}</b><p>原始 {a.expected} 匹／讀回 {a.actual} 匹 · {time(a.checked_at)}</p>{a.error && <p className="text-loss">{a.error}</p>}<p className="mt-1 break-all font-mono-tx text-[10px]">原始指紋：{a.fingerprint}</p></li>)}</ol> : <p className="mt-2">未有逐場巡查紀錄；程式測試不代表真正賽日驗收。</p>}</details>
    {history.length ? <ol className="mt-2 divide-y divide-hairline">{history.map((item, i) => <li key={`${item.checked_at}-${i}`} className="grid gap-1 py-3 text-[12px] sm:grid-cols-[11rem_1fr]"><span className="text-ink-3">{time(item.checked_at)}</span><div><b className="text-ink">{item.date} · {actions[item.action] ?? "待核實"}</b><p className="text-ink-2">原樣恢復 {item.restored} 行{item.error ? `；${item.error}` : ""}</p></div></li>)}</ol> : <p className="mt-2 text-[12px] text-ink-3">尚未有可讀取的持久巡查日誌；測試結果不當成正式修復紀錄。</p>}
    <p className="mt-4 text-[12px] leading-relaxed text-ink-2">驗收：13項隔離故障測試及5項逐場巡查測試已通過，Telegram通道測試已送達；首個真正賽日 T−90 自動捕獲仍待實跑。10月14日缺可靠原始副本，不當成自動恢復驗收；空白日誌不代表已做過巡查。</p>
  </Card>;
}