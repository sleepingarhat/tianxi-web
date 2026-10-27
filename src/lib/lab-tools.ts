/** 功能頁工具牆（已開通馬騎練數據獨立比較）。路徑仍係 /lab。 */

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
    title: "馬騎練數據獨立比較",
    en: "Independent comparison",
    blurb: "分開比較兩匹馬、兩位騎師或兩位練馬師：Elo、條件切片、跑法同直接交手。",
    status: "ready",
    href: "/lab/h2h",
  },
] as const;
