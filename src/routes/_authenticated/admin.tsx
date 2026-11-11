import { createFileRoute, Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  Activity, Database, FileClock, Gauge, Layers, LayoutDashboard, Lock, Menu, Search, Settings, Users, Wallet, Wrench, X,
} from "lucide-react";

import { FixtureProvider } from "@/components/admin/fixtures";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { getAdminStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "監控端 · 天喜 TIANXI" },
      { name: "description", content: "天喜內部監控端：系統總覽、引擎健康、資料新鮮度、鎖定狀態、版本與盈虧。" },
      { property: "og:title", content: "監控端 · 天喜 TIANXI" },
      { property: "og:description", content: "天喜內部監控端。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin/overview", label: "系統總覽", icon: LayoutDashboard },
  { to: "/admin/engine-health", label: "引擎健康", icon: Gauge },
  { to: "/admin/data-freshness", label: "資料新鮮度", icon: Database },
  { to: "/admin/prediction-lock", label: "預測鎖定", icon: Lock },
  { to: "/admin/model-versions", label: "模型版本", icon: Layers },
  { to: "/admin/pnl", label: "盈虧", icon: Wallet },
  { to: "/admin/users-membership", label: "會員", icon: Users },
  { to: "/admin/traffic", label: "流量", icon: Activity },
  { to: "/admin/logs", label: "日誌", icon: FileClock },
  { to: "/admin/settings", label: "設定", icon: Settings },
  { to: "/admin/console", label: "運維工具", icon: Wrench },
] as const;

function AdminLayout() {
  const router = useRouter();
  const checkAdmin = useServerFn(getAdminStatus);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [cmd, setCmd] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return router.navigate({ to: "/auth" });
      try {
        const r = await checkAdmin();
        if (!cancelled) setIsAdmin(r.isAdmin);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => { cancelled = true; };
  }, [checkAdmin, router]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd((v) => !v); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => setOpen(false), [path]);

  if (isAdmin !== true) {
    return (
      <div className="tx-admin flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <p className="font-mono-tx text-[11px] tracking-[0.04em] text-gold">Tianxi ops</p>
          <p className="mt-2 text-[13px] text-ink-2">{isAdmin === null ? "核實權限中…" : "此帳號未獲授權進入監控端"}</p>
          {isAdmin === false ? <Link to="/" className="mt-3 inline-block text-[12px] text-gold underline">返回首頁</Link> : null}
        </div>
      </div>
    );
  }

  const nav = (
    <nav className="flex flex-col gap-0.5 p-2">
      {NAV.map((n) => {
        const active = path === n.to || path.startsWith(n.to + "/");
        const Icon = n.icon;
        return (
          <Link
            key={n.to}
            to={n.to}
            className={`flex items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-[12px] transition-colors ${active ? "bg-gold-bg text-gold" : "text-ink-2 hover:bg-paper-3 hover:text-ink"}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <FixtureProvider>
      <div className="tx-admin flex min-h-screen w-full">
        <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col border-r border-hairline bg-paper-2 md:flex">
          <Brand />
          {nav}
        </aside>
        {open ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <button type="button" aria-label="關閉選單" className="absolute inset-0 bg-paper/70" onClick={() => setOpen(false)} />
            <aside className="relative h-full w-60 border-r border-hairline bg-paper-2">
              <div className="flex items-center"><Brand /><button type="button" aria-label="關閉" className="ml-auto mr-3 text-ink-3" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button></div>
              {nav}
            </aside>
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-hairline bg-paper/95 px-3 backdrop-blur">
            <button type="button" aria-label="開啟選單" className="rounded-[6px] p-1.5 text-ink-2 hover:bg-paper-3 md:hidden" onClick={() => setOpen(true)}>
              <Menu className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCmd(true)}
              className="flex min-w-0 max-w-sm flex-1 items-center gap-2 rounded-[6px] border border-hairline bg-paper-2 px-2.5 py-1.5 text-[12px] text-ink-3 hover:border-gold"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">搜尋頁面…</span>
              <kbd className="ml-auto hidden rounded border border-hairline px-1 font-mono-tx text-[10.5px] sm:inline">⌘K</kbd>
            </button>
            <Link to="/" className="ml-auto inline-flex items-center gap-1 rounded-[6px] px-2 py-1.5 text-[11px] text-ink-3 hover:text-ink">
              <Activity className="h-3.5 w-3.5" /> 返回前台
            </Link>
          </header>
          <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 p-4 pb-20 md:p-6">
            <Outlet />
          </main>
        </div>
        <CommandDialog open={cmd} onOpenChange={setCmd}>
          <CommandInput placeholder="輸入頁面名稱…" />
          <CommandList>
            <CommandEmpty>搵唔到</CommandEmpty>
            <CommandGroup heading="監控端">
              {NAV.map((n) => (
                <CommandItem key={n.to} value={n.label + n.to} onSelect={() => { setCmd(false); router.navigate({ to: n.to }); }}>
                  <n.icon className="mr-2 h-4 w-4" /> {n.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </div>
    </FixtureProvider>
  );
}

function Brand() {
  return (
    <div className="px-4 py-3">
      <p className="text-[14px] font-bold text-ink">天喜<span className="text-gold">·</span>監控端</p>
      <p className="font-mono-tx text-[10.5px] tracking-[0.04em] text-ink-3">Tianxi ops</p>
    </div>
  );
}
