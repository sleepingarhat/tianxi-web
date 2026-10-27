import { QueryClient, QueryClientProvider, type Query } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  redirect,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { isArchivedProductPath } from "@/lib/product-scope";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { Toaster } from "@/components/ui/sonner";
import { TxCta } from "@/components/tx/ui";
import { supabase } from "@/integrations/supabase/client";
import { PendingFollowHandler } from "@/components/tx/PendingFollowHandler";
import { TierPreviewProvider } from "@/components/tx/gates/TierPreview";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="max-w-md text-center">
        <h1 className="fx-spotlight text-7xl font-bold text-ink">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-ink">找不到此頁面</h2>
        <p className="mt-2 text-sm text-ink-3">
          此頁面不存在或已移到其他位置。
        </p>
        <div className="mt-6">
          <TxCta asChild variant="deep"><Link to="/">返回首頁</Link></TxCta>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: ErrorComponentProps) {
  console.error(error);
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="max-w-md text-center">
        <h1 className="fx-spotlight text-xl font-semibold tracking-tight text-ink">
          暫時未能載入此頁面
        </h1>
        <p className="mt-2 text-sm text-ink-3">
          可以重新載入最新頁面，或返回首頁；原預測及紀錄不會因此更改。
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <TxCta
            variant="deep"
            onClick={() => {
              window.location.reload();
            }}
          >
            重新載入
          </TxCta>
          <TxCta asChild variant="outline"><a href="/">返回首頁</a></TxCta>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: ({ location }) => {
    if (location.pathname.startsWith("/lovable/")) return;
    if (!location.pathname.startsWith("/api/") && isArchivedProductPath(location.pathname)) {
      throw redirect({ to: "/", replace: true });
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "google-site-verification", content: "U1rOkFQ86Z5zKTmpozp2pQe2lPNuUF4ffGB0hHnQMNQ" },
      { title: "天喜賽馬 · 香港賽馬數據平台" },
      { name: "description", content: "專注香港賽馬，賽前凍結四揀、官方賽果派彩對帳及六彩池策略盈虧。" },
      { name: "author", content: "天喜 TIANXI" },
      { property: "og:title", content: "天喜賽馬 · 香港賽馬數據平台" },
      { property: "og:description", content: "專注沙田與跑馬地賽事，預測、賽果及策略盈虧公開可核對。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#0F5E49" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "天喜賽馬" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      {
        "script:ld+json": {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "天喜賽馬 TIANXI",
          url: "https://tianxi.racing",
          logo: "https://tianxi.racing/favicon-v10-512.png",
        },
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon-v10-48.png", type: "image/png", sizes: "48x48" },
      { rel: "icon", href: "/favicon-v10-96.png", type: "image/png", sizes: "96x96" },
      { rel: "icon", href: "/favicon-v10-192.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon-v10.png", sizes: "180x180" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => { if ('serviceWorker' in navigator && window.top === window.self) void navigator.serviceWorker.register('/sw.js').catch(() => {}); }, []);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        const privateReads = new Set(['todayPicksAll','verified-results-audit','pvr-frozen','freezeLedger','prediction-reconciliation','original-race-audit','exotic-trio-verified-original','withdrawal-tracker','topPicks','cmpStyles']);
        void queryClient.cancelQueries({ predicate: (q: Query) => privateReads.has(String(q.queryKey[0])) });
        queryClient.removeQueries({ predicate: (q: Query) => privateReads.has(String(q.queryKey[0])) });
      }
      if (event === "SIGNED_OUT") {
        queryClient.removeQueries({ queryKey: ["tier"] });
        queryClient.removeQueries({ queryKey: ["watchlist"] });
        queryClient.removeQueries({ queryKey: ["watch-notifications"] });
        queryClient.removeQueries({ queryKey: ["watch-latest"] });
        queryClient.removeQueries({ queryKey: ["my-membership"] });
        queryClient.removeQueries({ queryKey: ["telegram-link"] });
        queryClient.removeQueries({ queryKey: ["notification-prefs"] });
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        void queryClient.invalidateQueries({ queryKey: ["tier"] });
        void queryClient.invalidateQueries({ queryKey: ["watchlist"] });
        void queryClient.invalidateQueries({ queryKey: ["watch-notifications"] });
        void queryClient.invalidateQueries({ queryKey: ["my-membership"] });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <TierPreviewProvider><PendingFollowHandler /><Outlet /></TierPreviewProvider>
      <GoogleAnalytics />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
