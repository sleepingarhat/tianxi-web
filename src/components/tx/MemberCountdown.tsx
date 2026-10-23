import { useFoundingInfo } from "@/lib/founding-info";

/** 開閘倒數：真實會員滿設定門檻即開閘。 */
export function MemberCountdown() {
  const { data } = useFoundingInfo();
  if (!data) return <div className="h-[52px]" aria-hidden />;
  const { total, threshold, remaining, gate_open: gateOpen } = data;
  const pct = Math.min(100, (total / threshold) * 100);
  return (
    <div className="mt-4 max-w-md" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3 text-[12px]">
        <span>已註冊 <strong className="tabnum text-[16px] text-gold-strong">{total.toLocaleString()}</strong> ／ {threshold} 人</span>
        <span className="font-bold text-gold-strong">{gateOpen ? "收費閘已開 · 創始名額已滿" : `創始名額尚餘 ${remaining} 個`}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-deep-fg/15">
        <div className="h-full rounded-full bg-gold-strong transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
