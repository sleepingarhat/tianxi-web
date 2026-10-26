/** 研究室工具牆（本批只開通頭對頭；其餘仍即將推出／鎖定）。 */

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
    blurb: "自訂窗口同條件重播凍結預測；即將推出。",
    status: "soon",
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
    blurb: "走位節奏研究層；即將推出。",
    status: "soon",
  },
  {
    key: "going",
    title: "場地天氣",
    en: "Going & weather",
    blurb: "場地／天氣研究工具；即將推出。",
    status: "soon",
  },
  {
    key: "pool-opt",
    title: "彩池優化器",
    en: "Pool optimizer",
    blurb: "彩池組合優化；刻意未做。",
    status: "locked",
  },
] as const;
