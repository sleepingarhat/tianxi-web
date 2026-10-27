import { Outlet, createFileRoute } from "@tanstack/react-router";

import { FeaturePageGate } from "@/components/tx/gates/FeaturePageGate";

export const Route = createFileRoute("/lab")({
  head: () => ({
    meta: [
      { title: "研究室 · 天喜 TIANXI" },
      {
        name: "description",
        content: "Pro 研究層工具牆：頭對頭、走位、場地天氣、彩池優化。",
      },
      { property: "og:title", content: "研究室 · 天喜 TIANXI" },
      { property: "og:description", content: "Pro 研究層工具牆；未上線工具標明即將推出。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <FeaturePageGate min="pro" title="研究室">
      <Outlet />
    </FeaturePageGate>
  ),
});
