import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/tx/AppShell";
import { FeaturePageGate } from "@/components/tx/gates/FeaturePageGate";
import { Card, Disclaimer, PageHead, Pill } from "@/components/tx/ui";
import { LAB_TOOLS } from "@/lib/lab-tools";

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
      <LabPage />
    </FeaturePageGate>
  ),
});

function LabPage() {
  return (
    <AppShell page="lab" columns={false} wide ticker="研究室 · 研究層工具 · 非投注建議">
      <PageHead
        en="Research lab"
        title="研究室"
        desc="Pro 研究層 · 工具分批上線；未實作者標「即將推出」"
      />

      <section className="mx-4 mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LAB_TOOLS.map((tool) => {
          const ready = tool.status === "ready" && !!tool.href;
          const card = (
            <Card
              title={tool.title}
              en={tool.en}
              action={
                <Pill tone={tool.status === "locked" ? "lose" : ready ? "win" : "ink"}>
                  {ready ? "可用" : tool.status === "locked" ? "鎖定" : "即將推出"}
                </Pill>
              }
              className={ready ? "mx-0 my-0 h-full transition-transform hover:-translate-y-0.5" : "mx-0 my-0"}
            >
              <p className="text-[12px] leading-relaxed text-ink-2">{tool.blurb}</p>
              {ready ? (
                <p className="mt-2 text-[11px] font-bold text-gold">進入 →</p>
              ) : (
                <p className="mt-2 text-[10px] text-ink-3">研究層預告 · 功能本體未上線</p>
              )}
            </Card>
          );
          return ready ? (
            <Link
              key={tool.key}
              to={tool.href as "/lab/h2h" | "/lab/pace" | "/lab/going" | "/lab/pools"}
              className="block rounded-[8px] outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              {card}
            </Link>
          ) : (
            <div key={tool.key} className="relative opacity-90">
              {card}
            </div>
          );
        })}
      </section>

      <p className="mx-4 mt-4 text-[11px] leading-relaxed text-ink-3">
        頭對頭、走位節奏、場地天氣、彩池優化已開放；其餘工具分批上線。內容僅供研究參考，唔構成投注建議。
      </p>
      <Disclaimer />
    </AppShell>
  );
}
