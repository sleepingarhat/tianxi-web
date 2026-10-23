import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/tx/AppShell";
import { FreeStageRoadmap } from "@/components/tx/FreeStageRoadmap";
import { EngineLanding } from "@/components/tx/EngineLanding";
import { Disclaimer } from "@/components/tx/ui";
import { DEFAULT_PAYWALL_THRESHOLD } from "@/lib/freeStage";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "天喜賽馬 · 香港賽馬預測與策略盈虧" },
    { name: "description", content: `天喜香港賽馬預測：限時免費享Pro全站功能。首${DEFAULT_PAYWALL_THRESHOLD}名註冊會員於收費閘開放之日獲一年52週免費Pro會籍，總值HK$4,056。` },
    { property: "og:title", content: "天喜賽馬 · 香港賽馬數據平台" },
    { property: "og:description", content: `限時免費享Pro全站功能；首${DEFAULT_PAYWALL_THRESHOLD}名註冊會員於開閘之日獲52週免費Pro，總值HK$4,056。賽前凍結、賽後公開對帳。` },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: HomePage,
});

function HomePage() {
  return <AppShell page="dashboard" wide ticker="天喜香港賽馬 · 沙田／跑馬地 · 全站免費 · 賽前凍結、賽後公開對帳">
    <EngineLanding />
    <FreeStageRoadmap />
    <Disclaimer extra="首場前 90 分鐘凍結全日四揀及第五選；賽後只重算對帳，唔改凍結預測。" />
  </AppShell>;
}