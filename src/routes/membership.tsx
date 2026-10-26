import { createFileRoute, Link } from "@tanstack/react-router";

import { useAuthState } from "@/lib/useAuthState";

import { AppShell } from "@/components/tx/AppShell";
import { FreeStageRoadmap } from "@/components/tx/FreeStageRoadmap";
import { Button } from "@/components/ui/button";
import { FoundingMemberOffer } from "@/components/tx/FoundingMemberOffer";
import { MembershipStatus } from "@/components/tx/MembershipStatus";
import {CryptoPasses} from '@/components/tx/CryptoPasses';
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { FREE_STAGE_GOAL_MEMBERS, PRO_WEEKLY_PRICE_HKD } from "@/lib/freeStage";
import { useFoundingInfo } from "@/lib/founding-info";
import { Card, Disclaimer, PageHead, Pill } from "@/components/tx/ui";

export const Route = createFileRoute("/membership")({
  head: () => ({
    meta: [
      { title: "天喜會員 · 而家全站免費 · 天喜 TIANXI" },
      {
        name: "description",
        content:
          `天喜而家全站免費：香港賽馬全部功能免費使用。首${FREE_STAGE_GOAL_MEMBERS}名開閘送52週Pro，付款驗收及批准後才收費，滿額不自動開閘。`,
      },
      { property: "og:title", content: "天喜會員 · 而家全站免費" },
      {
        property: "og:description",
        content: `全部功能免費使用；首${FREE_STAGE_GOAL_MEMBERS}名創始優惠，收款須先驗收及批准；公開對帳永久免費。`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MembershipPage,
});

const STRENGTHS = [
  ["01", "數據化預測", "以香港賽事長期資料建立可重現預測，唔靠賽後改口或主觀貼士。"],
  ["02", "時序外驗證", "所有改動先用未見過嘅較後賽事驗證，降低只對舊數據有效嘅風險。"],
  ["03", "多來源核對", "賽事、馬匹及市場資料經一致性檢查；缺資料時直接隱藏，不以猜測補值。"],
  ["04", "機率化輸出", "Pro 顯示最終勝出、三甲及前四機率，方便比較同場相對強弱。"],
  ["05", "持續監察", "新訊號要跨時段維持改善先會採用，單次漂亮結果不足以推出。"],
  ["06", "永久公開對賬", "過往預測同實際賽果長期公開，準確度由你自行核實。"],
];

const FEATURES = [
  ["賽前預測", "全日賽事四揀與第五選"],
  ["選馬對照", "模型搏冷＋市場穩陣雙欄"],
  ["機率與信心", "每匹馬機率及信心分"],
  ["排位與賠率", "賽事資料、臨場盤口對照"],
  ["賽果與盈虧", "逐場對帳、六彩池策略盈虧"],
  ["引擎與回測", "健康監察、歷史回測與公開戰績"],
];

function MembershipPage() {
  const { signedIn } = useAuthState();
  const { data: info } = useFoundingInfo();
  const GOAL_MEMBERS = info?.threshold ?? FREE_STAGE_GOAL_MEMBERS;
  const foundingSlots = info?.founding_slots ?? FREE_STAGE_GOAL_MEMBERS;
  return (
    <AppShell
      page="dashboard"
      ticker={`全站免費中 · 收費未開放 · 創始門檻 ${GOAL_MEMBERS.toLocaleString()} 人 · 付款驗收及批准後才開閘`}
    >
      <PageHead
        en="Free Stage · Tianxi Pro"
        title="限時免費 · 享 Pro 全站功能"
        desc={`香港賽馬全部功能免費使用，冇隱藏收費。創始門檻${GOAL_MEMBERS.toLocaleString()}人，滿額不自動開閘；付款驗收及批准後才收費，iOS App尚未推出。而家功能權益等同 Pro，並非已開通付費訂閱，現階段唔收款。`}
      />

      <div className="grid grid-cols-2 gap-3 px-4 py-5">
        <Button asChild variant="outline" className="h-11 border-hairline bg-paper text-ink hover:bg-paper-2"><Link to="/track-record">公開戰績 →</Link></Button>
        {signedIn ? (
          <Button asChild className="h-11 bg-deep text-deep-fg hover:bg-deep/90"><Link to="/predictor">睇今日四揀 →</Link></Button>
        ) : signedIn === false ? (
          <>
            <Button asChild className="h-11 bg-deep text-deep-fg hover:bg-deep/90"><Link to="/auth" search={{ mode: "signup" }}>現在註冊 →</Link></Button>
            <Link to="/auth" className="col-span-2 text-center text-[12px] text-ink-3 underline underline-offset-4">已有帳戶？登入</Link>
          </>
        ) : null}
      </div>

      <PaymentTestModeBanner />
      <FoundingMemberOffer />

      <div className="space-y-6 py-5 [&>section]:my-0">
      <MembershipStatus />
      <CryptoPasses offer />
      <Card title="全站功能權益" en="Pro access" action={<Pill tone="win">限時免費</Pill>}>
        <p className="mb-4 text-[13px] leading-relaxed text-ink-2">而家免費使用以下全部功能，權益等同 Pro；唔限每日一場，亦冇「不包括」嘅功能限制。</p>
        <dl className="divide-y divide-hairline">
          {FEATURES.map(([name, detail]) => <div key={name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"><div className="min-w-0"><dt className="text-[13px] font-bold text-ink">{name}</dt><dd className="mt-1 text-[12px] leading-relaxed text-ink-3">{detail}</dd></div><span className="shrink-0 whitespace-nowrap text-[12px] font-bold text-win">已包括 ✓</span></div>)}
        </dl>
        <p className="mt-4 border-t border-hairline pt-3 text-[11px] leading-relaxed text-ink-3">收費閘：門檻 {GOAL_MEMBERS} 人，須付款驗收及批准後才開放，滿額不自動收費。首 {foundingSlots} 名真實會員開閘後送 52 週 Pro；之後加入嘅會員開閘後按 HK${PRO_WEEKLY_PRICE_HKD}／星期訂閱。Telegram Pro 頻道為 Pro 會員專享，於<Link to="/account" className="text-gold">個人頁</Link>連結後申請加入；通知啟用及送達仍待驗收。</p>
      </Card>

      <FreeStageRoadmap />

      <Card title="將來收費方案" en="Pro · Not open" action={<Pill tone="ink">未開放</Pill>}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <h3 className="font-serif-tc text-[18px] font-bold text-ink">Pro 會員</h3><Pill tone="gold">唯一方案</Pill>
        </div>
        <p className="tabnum mt-4 font-mono-tx text-[28px] font-bold text-ink">HK${PRO_WEEKLY_PRICE_HKD}<span className="ml-2 inline-block text-[12px] font-normal text-ink-3">／星期 · Stripe · 可隨時取消</span></p>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-2">可用全站所有功能，將來可能增設其他會員資格。收入支持天喜持續維護、研究同升級預測系統。</p>
        <p className="mt-4 border-t border-hairline pt-3 text-[12px] leading-relaxed text-ink-3">創始門檻 {GOAL_MEMBERS} 人；付款驗收及批准後才收費，iOS App上架另待安排；屆時冇免費試用。首 {foundingSlots} 名會員獲贈嘅 52 週 Pro 會籍毋須付款，期滿後可選擇按 HK${PRO_WEEKLY_PRICE_HKD}／星期續訂。公開對帳同歷史成績永久免費。</p>
      </Card>
      </div>

      <Card title="引擎技術實力" en="Why Tianxi">
        <div className="divide-y divide-hairline">
          {STRENGTHS.map(([no, h, body]) => (
            <div key={no} className="py-2.5">
              <div className="flex items-center gap-2">
                <span className="tabnum font-mono-tx text-[11px] font-bold text-gold">{no}</span>
                <span className="font-serif-tc text-[13px] font-bold text-ink">{h}</span>
              </div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-2">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-ink-2">
          天喜唔係貼士佬主觀感覺，而係<b className="text-ink">可驗證、可問責</b>嘅數據引擎。
        </p>
      </Card>

      <p className="mx-4 mt-2 text-[10px] text-ink-3">Pro 開發者只讀 API 文件：<Link to="/developers" className="text-gold">/developers</Link></p>
      <Disclaimer extra="天喜為分析平台，不提供投注服務，亦不保證任何回報。" />
    </AppShell>
  );
}
