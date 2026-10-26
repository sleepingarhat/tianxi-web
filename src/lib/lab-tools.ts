/** 研究室工具牆（頭對頭、走位、場地天氣、彩池優化、回測入口）。 */

export type LabTool = {
  key: string;
  title: string;
  en: string;
  blurb: string;
  status: "soon" | "locked" | "ready";
  href?: string;
};

export const LAB_TOOLS: readonly LabTool[] = [
  {
    key: "backtest",
    title: "自訂回測",
    en: "Custom backtest",
    blurb: "自訂窗口同條件重播凍結預測；已喺特徵頁提供。",
    status: "ready",
    href: "/features",
  },
  {
    key: "compare",
    title: "比較器",
    en: "Comparator",
    blurb: "模型對模型／市場對照；即將推出。",
    status: "soon",
  },
  {
    key: "h2h",
    title: "頭對頭",
    en: "Head-to-head",
    blurb: "馬匹／騎師 Elo、條件切片、跑法同直接交手對照。",
    status: "ready",
    href: "/lab/h2h",
  },
  {
    key: "pace",
    title: "走位節奏",
    en: "Pace rhythm",
    blurb: "分段時間、走位 bump chart、今場跑法組成同節奏研究提示。",
    status: "ready",
    href: "/lab/pace",
  },
  {
    key: "going",
    title: "場地天氣",
    en: "Going & weather",
    blurb: "地況快照、檔位熱圖、跑法偏差、「今日合地」研究名單。",
    status: "ready",
    href: "/lab/going",
  },
  {
    key: "pool-opt",
    title: "彩池優化器",
    en: "Pool optimizer",
    blurb: "凍結 pWin + Harville 組合機率；研究層・唔入公開戰績。",
    status: "ready",
    href: "/lab/pools",
  },
] as const;
