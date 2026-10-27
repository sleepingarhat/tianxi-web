import { FeaturePageGate } from "@/components/tx/gates/FeaturePageGate";
import { FeaturesWorkspace } from "@/components/tx/FeaturesWorkspace";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "特徵排序表 · 天喜 TIANXI" },
      {
        name: "description",
        content: "逐場賽馬特徵排序：同場對賽勝次、最佳同程、檔位、最快時間與末段、騎練合作，可自選組合運算綜合排序。可排序唔等於引擎未採用；Pro 可調權重，分數愈高愈好。",
      },
      { property: "og:title", content: "特徵排序表 · 天喜 TIANXI" },
      { property: "og:description", content: "全特徵目錄逐場排序與自選綜合排序，全部由歷史賽事資料實時運算。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <FeaturePageGate min="registered" title="特徵排序表">
      <FeaturesWorkspace />
    </FeaturePageGate>
  ),
});
