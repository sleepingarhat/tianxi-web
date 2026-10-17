import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/tx/AppShell";
import { PageHead } from "@/components/tx/ui";
import { RacingEvidenceBrowser } from "@/components/tx/RacingEvidenceBrowser";
const title = "預測分與賽果對帳 · 天喜香港賽馬";
const description = "逐場核對原始預測分、馬匹及騎練 Elo、預測次序與官方實際名次，缺失鎖點證據如實標示。";
export const Route = createFileRoute("/prediction-reconciliation")({ head: () => ({ meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }], links: [{ rel: "canonical", href: "https://tianxi.racing/prediction-reconciliation" }] }), component: Page });
function Page() { return <AppShell page="dashboard" wide ticker="原始預測分 · 官方賽果 · Elo 核對"><PageHead en="公開對帳" title="預測分與賽果對帳" desc="原值公開，結果如實；不改寫歷史預測。" /><div className="mx-4 my-3 flex gap-4 text-[12px] text-gold"><Link to="/model">模型說明</Link><Link to="/elo-log">Elo 每日更新</Link></div><RacingEvidenceBrowser mode="prediction" /></AppShell>; }