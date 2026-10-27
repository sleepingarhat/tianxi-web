/** 研究室工具牆（已開通頭對頭、場地天氣）。 */

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
    key: "h2h",
    title: "頭對頭",
    en: "Head-to-head",
    blurb: "馬匹／騎師 Elo、條件切片、跑法同直接交手對照。",
    status: "ready",
    href: "/lab/h2h",
  },
  {
    key: "going",
    title: "場地天氣",
    en: "Going & weather",
    blurb: "地況快照、檔位熱圖、跑法偏差、「今日合地」研究名單。",
    status: "ready",
    href: "/lab/going",
  },
] as const;
