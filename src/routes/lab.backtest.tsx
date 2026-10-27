import { FeaturePageGate } from "@/components/tx/gates/FeaturePageGate";
import { FeaturesWorkspace } from "@/components/tx/FeaturesWorkspace";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/lab/backtest")({
  head: () => ({
    meta: [
      { title: "自訂回測 · 研究室 · 天喜 TIANXI" },
      {
        name: "description",
        content: "Pro 研究室自訂特徵權重回測、訓練／驗證分段、官方／Elo 基線對照（研究層，唔入公開戰績）。",
      },
      { property: "og:title", content: "自訂回測 · 研究室 · 天喜 TIANXI" },
      { property: "og:description", content: "Pro 研究室自訂回測。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <FeaturePageGate min="pro" title="自訂回測">
      <FeaturesWorkspace variant="lab" />
    </FeaturePageGate>
  ),
});
