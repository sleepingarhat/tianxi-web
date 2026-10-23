import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, Pill } from "@/components/tx/ui";
import { createCheckoutSession, createPortalSession, getMyMembership } from "@/lib/payments.functions";
import { track } from "@/lib/track";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { FREE_STAGE_GOAL_MEMBERS, FOUNDING_PRO_WEEKS, PRO_WEEKLY_PRICE_HKD } from "@/lib/freeStage";
import { useWatchSet } from "@/lib/useWatchSet";
import { useAuthState } from "@/lib/useAuthState";

const fmt = (s: string | null) => (s ? new Date(s).toLocaleDateString("zh-HK", { timeZone: "Asia/Hong_Kong" }) : "—");

function env() {
  try { return getStripeEnvironment(); } catch { return null; }
}

export function MembershipStatus() {
  const { signedIn } = useAuthState();
  const watch = useWatchSet();
  const [checkout, setCheckout] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const getFn = useServerFn(getMyMembership);
  const checkoutFn = useServerFn(createCheckoutSession);
  const portalFn = useServerFn(createPortalSession);
  const environment = env();

  const q = useQuery({
    queryKey: ["my-membership", environment],
    enabled: !!signedIn && !!environment,
    queryFn: () => { if (!environment) throw new Error("付款功能未啟用"); return getFn({ data: { environment } }); },
  });

  const body = (() => {
    if (signedIn === null) return <p className="text-[13px] text-ink-3">讀取中…</p>;
    if (!signedIn) return (
      <div className="grid gap-3">
        <p className="text-[13px] text-ink-2">登入後可以睇到你自己嘅會籍、註冊名次同訂閱狀態。</p>
        <Button asChild className="h-11 bg-deep text-deep-fg hover:bg-deep/90"><Link to="/auth">登入睇我嘅會籍</Link></Button>
      </div>
    );
    if (!environment) return <p className="text-[13px] text-ink-3">付款功能未正式啟用。</p>;
    if (q.isLoading) return <p className="text-[13px] text-ink-3">讀取中…</p>;
    if (q.error || !q.data) return <p className="text-[13px] text-loss">暫時讀唔到會籍，請稍後再試。</p>;
    const { entitlement: e, rank } = q.data;
    const foundingSlots = q.data.foundingSlots ?? FREE_STAGE_GOAL_MEMBERS;
    const rows: [string, string][] = [["註冊名次", rank ? `第 ${rank} 名` : "—"]];
    let headline = "";
    let canSubscribe = false;
    switch (e.kind) {
      case "free_stage": headline = "限時免費 · 享 Pro 全站功能"; rows.push(["開閘", `尚欠 ${e.remaining} 名註冊`]);
        if (rank && rank <= foundingSlots) rows.push(["開閘後", `自動轉 Pro 一年（${FOUNDING_PRO_WEEKS} 週）`]);
        else if (rank) rows.push(["開閘後", `你係第 ${rank} 名；首 ${foundingSlots} 名先有 ${FOUNDING_PRO_WEEKS} 週免費 Pro，可按 HK$${PRO_WEEKLY_PRICE_HKD}／星期訂閱`]); break;
      case "founding": headline = `Pro 會員（首 ${foundingSlots} 名一年贈送）`; rows.push(["有效至", fmt(e.until)], ["期滿後", `可自行按 HK$${PRO_WEEKLY_PRICE_HKD}／星期續訂`]); break;
      case "crypto_pass": headline = "Pro 會員（52週一次性加密貨幣通行證）"; rows.push(["有效至",fmt(e.until)]); break;
      case "founding_expired": headline = "一年贈送 Pro 已期滿"; rows.push(["期滿日", fmt(e.until)]); canSubscribe = true; break;
      case "subscribed": headline = e.cancelAtPeriodEnd ? "Pro 會員（已取消，用到本期完）" : "Pro 會員（每星期自動續訂）"; rows.push([e.cancelAtPeriodEnd ? "Pro 用到" : "下次續訂", fmt(e.until)]); break;
      case "payment_failed": headline = "扣款失敗 · Pro 已暫停"; rows.push(["處理", "更新付款方法後即恢復"]); break;
      case "none": headline = "未訂閱 Pro"; canSubscribe = true; break;
    }
    return (
      <div className="grid gap-4">
        {e.kind === "founding" && <p className="rounded-md border border-gold-strong/50 bg-gold-bg px-3 py-2 text-[12px] font-bold text-gold">收費閘已開：你係首 {foundingSlots} 名會員，已自動轉 Pro，唔使付款。</p>}
        <p className="font-serif-tc text-[17px] font-bold text-ink">{headline}</p>
        <dl className="divide-y divide-hairline">{rows.map(([k, v]) => <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2 text-[13px]"><dt className="text-ink-3">{k}</dt><dd className="font-bold text-ink">{v}</dd></div>)}</dl>
        {canSubscribe && !checkout && <Button className="h-11 bg-deep text-deep-fg hover:bg-deep/90" onClick={() => { setErr(null); track("begin_checkout", { currency: "HKD", value: PRO_WEEKLY_PRICE_HKD }); setCheckout(true); }}>訂閱 Pro · HK${PRO_WEEKLY_PRICE_HKD}／星期</Button>}
        {q.data.hasBilling && (
          <Button variant="outline" className="h-11" onClick={async () => {
            const r = await portalFn({ data: { environment, returnUrl: window.location.href } });
            if ("error" in r) setErr(r.error); else window.open(r.url, "_blank");
          }}>管理訂閱／付款方法／取消</Button>
        )}
        {checkout && (
          <div id="checkout">
            <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret: async () => {
              const r = await checkoutFn({ data: { environment, returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}` } });
              if ("error" in r) { setErr(r.error); setCheckout(false); throw new Error(r.error); }
              return r.clientSecret;
            } }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
        {err && <p className="text-[12px] text-loss">{err}</p>}
      </div>
    );
  })();

  return <Card title="我嘅會籍" en="My membership" action={<Pill tone="ink">個人</Pill>}>{signedIn ? <Link to="/my-horses" className="mb-3 block text-xs font-bold text-gold">我的愛駒（{watch.data?.activeCount ?? "—"} 匹） →</Link> : null}{body}</Card>;
}
