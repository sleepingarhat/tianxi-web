import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/tx/AppShell";
import { FeaturePageGate } from "@/components/tx/gates/FeaturePageGate";
import { Card, Disclaimer, PageHead, Pill } from "@/components/tx/ui";
import { LAB_TOOLS } from "@/lib/today-dashboard";

export const Route = createFileRoute("/lab")({
  head: () => ({
    meta: [
      { title: "研究室 · 天喜 TIANXI" },
      { name: "description", content: "Pro 研究層工具牆：回測、比較、頭對頭、走位、場地天氣、彩池優化（分批上線）。" },
      { property: "og:title", content: "研究室 · 天喜 TIANXI" },
      { property: "og:description", content: "Pro 研究層工具牆（外殼）；未上線工具標明即將推出。" },
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
        desc="Pro 研究層外殼 · 六個工具位分批上線；未實作者標「即將推出」，唔假做功能"
      />

      <section className="mx-4 mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LAB_TOOLS.map((tool) => {
            const soon = tool.status !== "ready";
            const body = (
              <Card
                key={tool.key}
                title={tool.title}
                en={tool.en}
                action={
                  <Pill tone={tool.status === "locked" ? "lose" : tool.status === "ready" ? "win" : "ink"}>
                    {tool.status === "ready" ? "可用" : tool.status === "locked" ? "鎖定" : "即將推出"}
                  </Pill>
                }
              >
                <p className="text-[12px] leading-relaxed text-ink-2">{tool.blurb}</p>
                {soon ? (
                  <p className="mt-2 text-[10px] text-ink-3">研究層預告 · 本批只做外殼，功能本體未上線</p>
                ) : tool.href ? (
                  <p className="mt-2">
                    <Link to={tool.href as "/"} className="text-[11px] font-bold text-gold">
                      進入 →
                    </Link>
                  </p>
                ) : null}
              </Card>
            );
            return soon ? (
              <div key={tool.key} className="relative opacity-90">
                {body}
              </div>
            ) : (
              body
            );
          })}
      </section>

      <p className="mx-4 mt-4 text-[11px] leading-relaxed text-ink-3">
        頭對頭留第二批（需 Worker API）；自訂回測／比較器／走位／場地天氣本批未做；彩池優化器（#9）刻意未做。
      </p>
      <Disclaimer />
    </AppShell>
  );
}
