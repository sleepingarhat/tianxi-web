import { createFileRoute } from "@tanstack/react-router";

// 凍結對帳表公開代理：主站自訂網域 → Worker /api/analyze/freeze-ledger。
// 只讀已鎖 prediction_log；純轉發，唔碰凍結預測、唔重算。
const WORKER_BASE = "https://tianxi-backend.tianxi-entertainment.workers.dev";
const UPSTREAM_TIMEOUT_MS = 15_000;
const FALLBACK_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=86400";

/** Edge cache when the host runtime provides one (Cloudflare caches.default); otherwise skipped. */
function edgeCache(): Cache | null {
  try {
    return ((globalThis as unknown as { caches?: { default?: Cache } }).caches?.default ??
      null) as Cache | null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/freeze-ledger")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const qs = new URLSearchParams();
        const dates = url.searchParams.get("dates");
        const since = url.searchParams.get("since");
        if (dates) qs.set("dates", dates);
        if (since) qs.set("since", since);
        const suffix = qs.toString() ? `?${qs.toString()}` : "";
        const cache = edgeCache();
        const cacheKey = new Request(`${url.origin}/api/public/freeze-ledger${suffix}`, {
          method: "GET",
        });
        const ifNoneMatch = request.headers.get("If-None-Match");
        if (cache) {
          try {
            const hit = await cache.match(cacheKey);
            if (hit) {
              const etag = hit.headers.get("ETag");
              if (
                etag &&
                ifNoneMatch &&
                ifNoneMatch
                  .split(",")
                  .some((t) => t.trim().replace(/^W\//, "") === etag.replace(/^W\//, ""))
              ) {
                return new Response(null, { status: 304, headers: hit.headers });
              }
              return hit;
            }
          } catch {
            /* cache is best-effort */
          }
        }
        try {
          const res = await fetch(`${WORKER_BASE}/api/analyze/freeze-ledger${suffix}`, {
            headers: {
              Accept: "application/json",
              ...(ifNoneMatch ? { "If-None-Match": ifNoneMatch } : {}),
            },
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
          });
          const headers = new Headers({ "Content-Type": "application/json; charset=utf-8" });
          const etag = res.headers.get("ETag");
          if (etag) headers.set("ETag", etag);
          if (res.status === 304) {
            headers.set(
              "Cache-Control",
              res.headers.get("Cache-Control") ?? FALLBACK_CACHE_CONTROL,
            );
            return new Response(null, { status: 304, headers });
          }
          const text = await res.text();
          headers.set(
            "Cache-Control",
            res.ok ? (res.headers.get("Cache-Control") ?? FALLBACK_CACHE_CONTROL) : "no-store",
          );
          const out = new Response(text, { status: res.status, headers });
          if (cache && res.ok && !/no-store/i.test(headers.get("Cache-Control") ?? "")) {
            try {
              await cache.put(cacheKey, out.clone());
            } catch {
              /* cache is best-effort */
            }
          }
          return out;
        } catch (err) {
          const timedOut = (err as { name?: string } | null)?.name === "TimeoutError";
          return new Response(
            JSON.stringify({
              ok: false,
              error: timedOut
                ? "freeze ledger upstream timeout"
                : "freeze ledger upstream unavailable",
              detail: String(err),
            }),
            {
              status: timedOut ? 504 : 502,
              headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control": "no-store",
              },
            },
          );
        }
      },
    },
  },
});
