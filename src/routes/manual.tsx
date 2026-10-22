import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/tx/AppShell";
import { Card, Disclaimer, PageHead, Seg } from "@/components/tx/ui";
import { dataScaleSentence, useDataStats } from "@/lib/data-stats";

export const Route = createFileRoute("/manual")({
  head: () => ({
    meta: [
      { title: "天喜引擎說明書 · 天喜 TIANXI" },
      { name: "description", content: "由零開始講清楚天喜系統：數據點嚟、點爬、引擎點計、用咩模型同理論，到逐個功能點用。" },
      { property: "og:title", content: "天喜引擎說明書 · 天喜 TIANXI" },
      { property: "og:description", content: "數據篇、技術篇、使用篇、答客問。" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManualPage,
});

type Tab = "data" | "tech" | "use" | "faq";

// 佔位：渲染時換成 D1 即時數量（唔寫死數字）。
const DATA_SCALE_ITEM = "__DATA_SCALE__";

const SECTIONS: Record<Tab, { en: string; title: string; blocks: { h: string; items: string[] }[] }> = {
  data: {
    en: "DATA · AUTOMATION & SOURCING",
    title: "① 數據篇 · 數據點嚟、點爬、穩唔穩",
    blocks: [
      {
        h: "自動化運作原理",
        items: [
          "賽前：排位公佈後，自動抓取每場排位表（馬匹、檔位、騎練、負磅）並寫入資料庫。",
          "觸發預測：排位一入庫，即時跨系統觸發引擎重新訓練同預測，唔使等到賽馬日朝早。",
          "賽後：賽果一出，自動抓取名次、賠率、派彩、賽事評述（走位、受阻等）同血統資料。",
          "增量更新：只寫入有變動嘅資料（delta），重複寫入會自動合併（idempotent）。",
        ],
      },
      {
        h: "數據來源細節",
        items: [
          "全部來自香港賽馬會（HKJC）公開官方資料。",
          "排位表：出賽馬匹、檔位、騎師、練馬師、負磅、評分。",
          "賽果同賠率：名次、勝出賠率、各式派彩。",
          "賽事評述（走位）：每匹馬跑法、受阻、走大疊、出閘描述。",
          "馬匹／騎師／練馬師檔案、血統（父系、母父系）、試閘記錄、臨場賠率快照。",
        ],
      },
      {
        h: "數據涵蓋範圍",
        items: [
          "時間：2016 年 9 月至今，全部香港賽事。",
          DATA_SCALE_ITEM,
          "場地：只收香港本地（沙田 ST、跑馬地 HV），海外／模擬賽自動過濾。",
        ],
      },
      {
        h: "爬取穩定性",
        items: [
          "幽靈場次防禦：三層攔截（來源閘／顯示閘／守衛式清理）。",
          "海外賽過濾：讀寫兩邊只認 ST／HV。",
          "自我修復：失敗自動重試；cron 與事件觸發互為備援。",
          "賠率定時修剪：每日清走過期快照，控制資料庫體積。",
        ],
      },
    ],
  },
  tech: {
    en: "TECH · MODEL & THEORY",
    title: "② 技術篇 · 引擎點計、用咩模型",
    blocks: [
      {
        h: "兩層集成",
        items: [
          "LightGBM LambdaRank：把同場出賽馬列為一條排序名單，學場內相對名次，唔係預測秒數。",
          "天喜Elo v12：馬／騎／練 70／20／10，加檔位與負磅修正，作獨立後備模型。",
          "機率混合：p = α · softmax(天喜LGB/τ) + (1−α) · softmax(天喜Elo/τ)；健康閘 FAIL 時 α = 0。",
          "臨場賠率只作市場對照欄，不進入排序模型。",
        ],
      },
      {
        h: "驗證方法",
        items: [
          "時序外驗證：改動先用未見過嘅較後賽事測試，避免只對舊數據有效。",
          "健康閘：樣本量、四揀平均中匹數（目標 3／4）、三甲任中、三重彩覆蓋逐項守門（PASS／WATCH／FAIL）。",
          "凍結對賬：命中率只計最終版已鎖四揀，初版不入賬。",
        ],
      },
    ],
  },
  use: {
    en: "USAGE · FEATURE GUIDE",
    title: "③ 使用篇 · 逐個功能點用",
    blocks: [
      {
        h: "頁面導覽",
        items: [
          "儀表板：當日／上次賽馬日概況、免費精選、90 日命中率。",
          "選馬：引擎首選表 + 特徵排序實驗室（10 項特徵任選，即時算綜合排序）。",
          "日程：按月瀏覽賽馬日，展開場次直入排位表。",
          "百科：馬匹搜尋、天喜Elo 評分榜、騎師練馬師統計。",
          "引擎：架構、健康守門、監控清單、公開戰績。",
        ],
      },
      {
        h: "睇數要點",
        items: [
          "pWin 係同場相對機率，唔係必勝率。",
          "彩池顯示：全站只列三重彩（模型首三匹打複式）同四重彩（模型首四匹打複式）；只要實際頭三／頭四名全部落在模型首三／首四匹之內即算命中。",
          "缺資料時直接隱藏，不以猜測補值。",
        ],
      },
    ],
  },
  faq: {
    en: "FAQ",
    title: "④ 答客問",
    blocks: [
      {
        h: "常見問題",
        items: [
          "問：天喜有冇提供投注服務？答：冇。天喜係分析平台，只提供數據與機率分析。",
          "問：命中率會唔會事後改？答：唔會。預測鎖定後凍結，賽後用官方名次對賬，永久公開。",
          "問：休季期間點解冇 live 曲線？答：休季自動暫停屬預期，儀表板會標示「上次賽馬日」。",
          "問：為何有時只用 天喜Elo？答：健康閘 FAIL 時 α 歸零，改用較保守嘅後備模型。",
        ],
      },
    ],
  },
};

function ManualPage() {
  const [tab, setTab] = useState<Tab>("data");
  const sec = SECTIONS[tab];
  const dataStats = useDataStats();

  return (
    <AppShell page="engine" ticker="說明書 · 透明可問責">
      <PageHead
        en="Owner's Handbook"
        title="天喜引擎說明書"
        desc="由零開始講清楚天喜成套系統點運作 —— 透明可問責係天喜嘅底線。"
      />

      <div className="mx-4">
        <Seg
          value={tab}
          onChange={setTab}
          options={[
            { value: "data", label: "① 數據篇" },
            { value: "tech", label: "② 技術篇" },
            { value: "use", label: "③ 使用篇" },
            { value: "faq", label: "④ 答客問" },
          ]}
        />
      </div>

      <Card title={sec.title} en={sec.en}>
        <div className="space-y-4">
          {sec.blocks.map((b) => (
            <div key={b.h}>
              <h3 className="mb-1.5 font-serif-tc text-[13px] font-bold text-ink">{b.h}</h3>
              <ul className="space-y-1.5">
                {b.items.map((it) => (
                  <li key={it} className="flex gap-2 text-[12px] leading-relaxed text-ink-2">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-gold" />
                    <span>{it === DATA_SCALE_ITEM ? dataScaleSentence(dataStats.data) : it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Card title="相關頁面" en="Links">
        <div className="flex flex-wrap gap-3 text-[12px] font-bold text-gold">
          <Link to="/engine">引擎頁 →</Link>
          <Link to="/track-record">公開戰績 →</Link>
          <Link to="/dev-log">開發者日誌 →</Link>
        </div>
      </Card>

      <Disclaimer />
    </AppShell>
  );
}
