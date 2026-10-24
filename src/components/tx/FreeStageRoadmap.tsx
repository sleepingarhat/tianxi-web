import { Link } from "@tanstack/react-router";

import { FREE_STAGE_GOAL_MEMBERS } from "@/lib/freeStage";
import { Card, Pill } from "@/components/tx/ui";
import { useFoundingInfo } from "@/lib/founding-info";

/** 全站商業路線：免費階段 → 目標門檻 → 付款驗收及批准後收費。門檻由用戶拍板（2026-10-13），改動要同步藍圖／roadmap／dev-log。 */
function roadmapSteps(GOAL_MEMBERS: number): { id: string; name: string; state: "now" | "todo"; desc: string; tag: string }[] { return [
  {
    id: "01",
    name: "而家：限時免費 Pro 功能",
    state: "now",
    desc: "香港賽馬全部功能免費使用，包括四揀預測、排位表、逐場對帳、六彩池策略盈虧同回測。功能權益等同 Pro，現階段唔收款。",
    tag: "進行中",
  },
  {
    id: "02",
    name: `目標：免費會員 ${GOAL_MEMBERS.toLocaleString()} 人`,
    state: "todo",
    desc: "呢個數目只表示會員進度；滿額唔會自動開閘。付款驗收及批准後才開放收費，iOS App另待安排。",
    tag: "等呢一步",
  },
  {
    id: "03",
    name: "之後：付款驗收及批准・iOS App",
    state: "todo",
    desc: "付款驗收及批准後先開付費方案；iOS App Store 上架另待安排。已鎖定嘅預測、公開對帳同歷史成績一律照舊免費、唔改數。",
    tag: "未開放",
  },
]; }

export function FreeStageRoadmap() {
  const { data } = useFoundingInfo();
  const GOAL_MEMBERS = data?.threshold ?? FREE_STAGE_GOAL_MEMBERS;
  const STEPS = roadmapSteps(GOAL_MEMBERS);
  return (
    <Card
      title="項目路線圖"
      en="Roadmap"
      action={
        <div className="flex flex-col items-end gap-2">
          <Pill tone="win">{data?.gate_open ? "收費閘已開" : "全站免費中"}</Pill>
          <Link to="/membership" className="font-mono-tx text-[10px] font-bold text-gold hover:underline">
            睇方案 →
          </Link>
        </div>
      }
    >
      <div className="mb-3 flex gap-1">
        {STEPS.map((s) => (
          <span
            key={s.id}
            className={`h-1.5 flex-1 rounded-full ${s.state === "now" ? "animate-pulse bg-gold" : "bg-hairline"}`}
          />
        ))}
      </div>
      <ol className="relative ml-3 border-l border-hairline">
        {STEPS.map((s) => (
          <li key={s.id} className="relative pb-3 pl-5 last:pb-0">
            <span
              className={`absolute -left-[9px] top-0.5 grid h-[18px] w-[18px] place-items-center rounded-full border-2 font-mono-tx text-[9px] font-bold ${
                s.state === "now" ? "border-gold bg-gold-bg text-gold" : "border-hairline bg-paper text-ink-3"
              }`}
            >
              {s.state === "now" ? "●" : ""}
            </span>
            <div className="px-1 pb-3">
              <p className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                
                <span className="font-serif-tc text-[13px] font-bold leading-tight text-ink">{s.name}</span>
                <Pill tone={s.state === "now" ? "gold" : "ink"}>{s.tag}</Pill>
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-3">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-2 border-t border-hairline pt-4 text-[10px] leading-relaxed text-ink-2">
        <b className="text-ink">會員進度門檻： {GOAL_MEMBERS.toLocaleString()} 人。</b>
        滿額不自動開閘；付款驗收及批准後才開始收費，iOS App尚未推出。公開對帳永久免費。
      </p>
    </Card>
  );
}
