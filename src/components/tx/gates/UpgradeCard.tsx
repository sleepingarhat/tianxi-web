import { Link } from "@tanstack/react-router";
import { Card, TxCta } from "@/components/tx/ui";
import { useTier, useFoundingInfo } from "@/lib/useTier";
import { PRO_WEEKLY_PRICE_HKD } from "@/lib/freeStage";
import { useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function UpgradeCard({ need, feature, inline = false }: { need: "registered" | "pro"; feature: string; inline?: boolean }) {
  const location = useLocation();
  const state = useTier();
  const { data: info } = useFoundingInfo();
  if (state.loading) return <div className="h-32 animate-pulse bg-paper-2" aria-label="讀取會籍中" />;
  if (state.error) return <Card title="暫時未能核實會籍"><p className="text-sm text-ink-2">請稍後重新載入，會員紀錄不會因此改動。</p></Card>;
  const registration = !state.signedIn || need === "registered";
  const title = registration ? "免費登記即可解鎖" : "升級 Pro 解鎖";
  const Frame = ({ children }: { children: ReactNode }) => inline ? <div className="py-3"><h3 className="mb-2 font-serif-tc text-sm font-bold text-ink">{title}</h3>{children}</div> : <Card title={title}>{children}</Card>;
  return <Frame>
    <p className="mb-4 text-sm leading-relaxed text-ink-2">{registration ? `${feature}屬註冊會員功能。免費登記即可使用會員功能。` : `${feature}屬 Pro 會員功能。HK$${PRO_WEEKLY_PRICE_HKD}／週，隨時取消。`}</p>
    {registration ? (
      <TxCta asChild variant="gold"><Link to="/auth" search={{ mode: "signup", next: location.href }}>免費登記</Link></TxCta>
    ) : (
      <TxCta asChild variant="outline"><Link to="/membership">查看 Pro 方案</Link></TxCta>
    )}
    {registration && <p className="mt-3 text-sm"><Link to="/auth">已有帳戶？登入</Link></p>}
    {registration && info && !info.gate_open && info.remaining > 0 && <p className="mt-3 text-xs text-ink-3">創始會員名額尚餘 {info.remaining} 個（首 {info.founding_slots} 名開閘後送 52 週 Pro）</p>}
  </Frame>;
}