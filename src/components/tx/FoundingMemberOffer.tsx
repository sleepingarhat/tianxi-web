import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemberCountdown } from "./MemberCountdown";
import { ShareButton } from "./ShareCard";
import { useAuthState } from "@/lib/useAuthState";
import { supabase } from "@/integrations/supabase/client";
import { FREE_STAGE_GOAL_MEMBERS, FOUNDING_PRO_WEEKS, FOUNDING_PRO_VALUE_HKD } from "@/lib/freeStage";

export function FoundingMemberOffer() {
  const { signedIn } = useAuthState();
  const { data: total } = useQuery({
    queryKey: ["public-member-count"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("public_member_count");
      if (error) throw error;
      return Number(data ?? 0);
    },
    enabled: !!signedIn,
  });
  return (
    <section aria-labelledby="founding-offer-title" className="border-y border-gold-strong/40 bg-deep px-5 py-6 text-deep-fg md:px-10 md:py-8">
      <div className="grid items-center gap-5 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className="flex min-w-0 items-center gap-2 text-[12px] font-bold text-gold-strong"><Gift className="h-4 w-4 shrink-0" aria-hidden />首 {FREE_STAGE_GOAL_MEMBERS} 名註冊會員專享</p>
            {signedIn ? (
              <ShareButton
                label="分享俾朋友"
                className="border-gold-strong/60 text-gold-strong hover:bg-gold-strong/10"
                spec={total === undefined ? null : { kind: "founding", joined: Number(total), goal: FREE_STAGE_GOAL_MEMBERS, weeks: FOUNDING_PRO_WEEKS, value: FOUNDING_PRO_VALUE_HKD, url: "https://tianxi.racing/auth?mode=signup" }}
              />
            ) : null}
          </div>
          <h2 id="founding-offer-title" className="mt-2 font-serif-tc text-[24px] font-bold leading-snug md:text-[28px]">免費一年 Pro 會籍<span className="ml-2 inline-block whitespace-nowrap text-gold-strong">（{FOUNDING_PRO_WEEKS} 週）</span></h2>
          <p className="mt-2 text-[14px] leading-relaxed">由開放收費閘之日起享用，總值 <strong className="tabnum whitespace-nowrap text-gold-strong">HK${FOUNDING_PRO_VALUE_HKD.toLocaleString()}</strong>，唔使另外付款。</p>
          <p className="mt-2 text-[12px] leading-relaxed text-deep-fg/80">而家限時全站免費，享有等同 Pro 嘅全站功能；現階段唔收款。</p>
          <MemberCountdown />
        </div>
        {signedIn === false ? (
          <Button asChild size="lg" className="h-12 w-full bg-gold-strong font-bold text-ink hover:bg-gold md:w-auto">
            <Link to="/auth" search={{ mode: "signup" }}>現在註冊<ArrowRight aria-hidden /></Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
