import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/tx/AppShell";
import { FreeStageRoadmap } from "@/components/tx/FreeStageRoadmap";
import { EngineLanding } from "@/components/tx/EngineLanding";
import { Disclaimer } from "@/components/tx/ui";
import { homepageHead } from "@/lib/homepage-seo";

export const Route = createFileRoute("/")({
  head: () => homepageHead(),
  component: HomePage,
});

function HomePage() {
  return <AppShell page="dashboard" wide ticker="天喜香港賽馬 · 沙田／跑馬地 · 全站免費 · 賽前凍結、賽後公開對帳">
    <EngineLanding />
    <FreeStageRoadmap />
    <Disclaimer extra="首場前 90 分鐘凍結全日四揀及第五選；賽後只重算對帳，唔改凍結預測。" />
  </AppShell>;
}