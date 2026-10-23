import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { track } from "@/lib/track";
import { PRO_WEEKLY_PRICE_HKD } from "@/lib/freeStage";
import { AppShell } from "@/components/tx/AppShell";
import { Card } from "@/components/tx/ui";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (s: Record<string, unknown>): { session_id?: string | undefined } => ({
    session_id: typeof s['session_id'] === "string" ? s['session_id'] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "付款完成 · 天喜 TIANXI" },
      { name: "description", content: "天喜 Pro 會員付款結果。" },
      { property: "og:title", content: "付款完成 · 天喜 TIANXI" },
      { property: "og:description", content: "天喜 Pro 會員付款結果。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReturnPage,
});

function ReturnPage() {
  const { session_id } = Route.useSearch();
  const queryClient = useQueryClient();
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ["tier"] });
    void queryClient.invalidateQueries({ queryKey: ["my-membership"] });
  }, [queryClient]);
  useEffect(() => {
    if (!session_id) return;
    const key = `tx_purchase_${session_id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    track("purchase", { transaction_id: session_id, currency: "HKD", value: PRO_WEEKLY_PRICE_HKD });
  }, [session_id]);
  return (
    <AppShell page="dashboard">
      <div className="px-4 py-6">
        <Card title={session_id ? "付款完成" : "搵唔到付款資料"} en="Checkout">
          <p className="text-[13px] leading-relaxed text-ink-2">{session_id ? "多謝支持！Pro 權限通常幾秒內開通，可以去會員頁睇你嘅訂閱狀態。" : "如果你啱啱付咗款，請去會員頁睇最新狀態。"}</p>
          <Button asChild className="mt-4 h-11 w-full bg-deep text-deep-fg hover:bg-deep/90"><Link to="/membership">去會員頁</Link></Button>
        </Card>
      </div>
    </AppShell>
  );
}
