import { FeaturePageGate } from "@/components/tx/gates/FeaturePageGate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/tx/AppShell";
import { PageHead } from "@/components/tx/ui";
import { RacingEvidenceBrowser } from "@/components/tx/RacingEvidenceBrowser";
const title = "Elo 每日更新日誌 · 天喜香港賽馬";
const description = "公開真正 v12 馬匹、騎師及練馬師賽後評分原值、前後變動與來源快照，補計及馬季回歸如實分辨。";
export const Route = createFileRoute("/elo-log")({ head: () => ({ meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }], links: [{ rel: "canonical", href: "https://tianxi.racing/elo-log" }] }), component: () => <FeaturePageGate min="registered" title="Elo 紀錄"><Page /></FeaturePageGate> });
function Page() { return <AppShell page="dashboard" wide ticker="真正 v12 · 三軸評分更新 · 來源可核對"><PageHead en="公開評分紀錄" title="Elo 每日更新日誌" desc="馬匹、騎師、練馬師：賽後快照與淨變動。" /><div className="mx-4 my-3 flex gap-4 text-[12px] text-gold"><Link to="/model">模型說明</Link><Link to="/prediction-reconciliation">預測與賽果對帳</Link></div><RacingEvidenceBrowser mode="elo" /></AppShell>; }