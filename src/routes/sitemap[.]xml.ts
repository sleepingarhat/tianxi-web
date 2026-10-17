import { createFileRoute } from "@tanstack/react-router";
import { sitemapXml } from "@/lib/race-seo";

const ORIGIN = "https://tianxi.racing";
const PATHS = [
  "/", "/predictor", "/cards", "/results", "/schedule", "/track-record", "/value-trend", "/prediction-vs-result",
  "/strategy-pnl", "/freeze-ledger", "/racing-health", "/explain", "/engine", "/engine/audit",
  "/engine/backtest", "/engine/features", "/engine/monitor", "/engine/residuals", "/pool-odds",
  "/horse", "/race", "/encyclopedia", "/manual", "/features", "/membership", "/dev-log", "/media-credits", "/model", "/prediction-reconciliation", "/elo-log",
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { getPublicRaceUrls } = await import("@/lib/racing-sitemap.server");
          const body = sitemapXml([...PATHS.map(p => `${ORIGIN}${p}`), ...await getPublicRaceUrls()]);
          return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
        } catch (error) {
          console.error("Racing sitemap unavailable", error);
          return new Response("網站地圖資料暫時未能完整讀取", { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "300" } });
        }
      },
    },
  },
});
