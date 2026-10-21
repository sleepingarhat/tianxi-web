import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { isArchivedProductPath } from "@/lib/product-scope";
import { isClientAbort, isStaleClientBuild } from "./lib/server-error-class";

const productScopeMiddleware = createMiddleware().server(async ({ request, next }) => {
  const path = new URL(request.url).pathname;
  if (path.startsWith("/lovable/")) return next();
  if (path.startsWith("/api/") && isArchivedProductPath(path)) {
    return Response.json({ ok: false, status: "archived", message: "此產品已暫時封存，天喜現時專注香港賽馬。" }, {
      status: 410,
      headers: { "cache-control": "no-store", "x-robots-tag": "noindex" },
    });
  }
  return next();
});

const errorMiddleware = createMiddleware().server(async ({ request, next }) => {
  if (new URL(request.url).pathname.startsWith("/lovable/")) return next();
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    // 訪客中途關頁／斷線會觸發 abort，唔係伺服器錯誤，唔入持久日誌。
    const aborted = isClientAbort(error, request.signal?.aborted);
    // 舊分頁持有上一個版本嘅伺服器函數編號：屬客戶端版本過期，唔係伺服器故障，
    // 記做警告並請客戶端重新整理，唔該计入「失敗」。
    const stale = isStaleClientBuild(error);
    if (!aborted) try {
      const { safeErrorMessage, writeOpsEvent } = await import("./lib/ops-history.server");
      await writeOpsEvent({
        eventKey: `server:${safeErrorMessage(error).slice(0, 120)}:${new Date().toISOString().slice(0, 13)}`,
        kind: "api_error",
        severity: stale ? "warning" : "error",
        source: "tanstack-server",
        statusCode: stale ? 409 : 500,
        message: safeErrorMessage(error),
      });
    } catch {
      // 持久日誌不可取代原本錯誤回應。
    }
    if (stale) {
      return new Response(JSON.stringify({ ok: false, status: "stale-client-build", message: "頁面版本已更新，請重新整理後再試。" }), {
        status: 409,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [productScopeMiddleware, errorMiddleware, csrfMiddleware],
}));
