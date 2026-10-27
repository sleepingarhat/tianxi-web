/** 研究室工具牆（已開通回測、比較器、頭對頭、走位節奏、場地天氣、彩池優化）。 */

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
    blurb: "自訂特徵權重回測、訓練／驗證分段、官方／Elo 基線對照。",
    status: "ready",
    href: "/lab/backtest",
  },
  {
    key: "compare",
    title: "比較器",
    en: "Comparator",
    blurb: "官方四揀／純 Elo／我的策略並列 KPI、累計盈虧同逐日差異（研究層）。",
    status: "ready",
    href: "/lab/compare",
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
