import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/tx/AppShell";
import { OraclePanel } from "@/components/tx/OraclePanel";
import { CoveragePanel, FeaturePanel, OpsPanel, SqlPanel, StatusPanel } from "@/components/admin/ConsolePanels";
import { Card, Loading, PageHead, Scroller } from "@/components/tx/ui";
import { supabase } from "@/integrations/supabase/client";
import { getAdminStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/console")({
  head: () => ({
    meta: [
      { title: "內部監控台 · 天喜 TIANXI" },
      { name: "description", content: "天喜內部運維監控台：資料覆蓋、工作流、警報與維護操作。" },
      { property: "og:title", content: "內部監控台 · 天喜 TIANXI" },
      { property: "og:description", content: "天喜內部運維監控台。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

type Tab = "picks" | "status" | "coverage" | "features" | "ops" | "sql";

const TABS: { key: Tab; label: string }[] = [
  { key: "picks", label: "即日預測" },
  { key: "status", label: "總覽 / 警報" },
  { key: "coverage", label: "資料覆蓋" },
  { key: "features", label: "特徵審計" },
  { key: "ops", label: "運維操作" },
  { key: "sql", label: "SQL 查詢" },
];


function AdminPage() {
  const router = useRouter();
  const checkAdmin = useServerFn(getAdminStatus);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("picks");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.navigate({ to: "/auth" });
        return;
      }
      try {
        const r = await checkAdmin();
        if (!cancelled) setIsAdmin(r.isAdmin);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checkAdmin, router]);

  if (isAdmin === null) {
    return (
      <AppShell ticker="內部監控台">
        <Loading label="核實權限中…" />
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell ticker="內部監控台 · 權限不足">
        <PageHead en="Restricted" title="無權進入" desc="此頁只限管理員帳戶。" />
        <Card title="權限不足" en="Forbidden">
          <p className="text-[12px] text-ink-2">你的帳戶未獲授權進入內部監控台。</p>
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              router.navigate({ to: "/auth" });
            }}
            className="mt-3 rounded-[8px] border border-hairline bg-paper-2 px-3 py-2 text-[12px] text-ink"
          >
            登出
          </button>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell ticker="內部監控台 · 只限管理員">
      <PageHead en="Internal Console" title="內部監控台" desc="經伺服器代理讀寫 tianxi-backend /admin/api/*，token 不會外露。" />

      <Scroller>
        <div className="flex gap-2 pb-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap rounded-[8px] border px-3 py-1.5 text-[12px] ${
                tab === t.key ? "border-gold bg-gold-bg text-ink" : "border-hairline bg-paper-2 text-ink-3"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Scroller>

      {tab === "picks" && <OraclePanel />}
      {tab === "status" && <StatusPanel />}
      {tab === "coverage" && <CoveragePanel />}
      {tab === "features" && <FeaturePanel />}
      {tab === "ops" && <OpsPanel />}
      {tab === "sql" && <SqlPanel />}

      <button
        type="button"
        onClick={async () => {
          await supabase.auth.signOut();
          router.navigate({ to: "/auth" });
        }}
        className="mt-4 w-full rounded-[8px] border border-hairline bg-paper-2 px-3 py-2 text-[12px] text-ink-3"
      >
        登出
      </button>
    </AppShell>
  );
}

