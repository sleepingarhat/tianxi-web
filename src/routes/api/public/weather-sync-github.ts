import { createFileRoute } from "@tanstack/react-router";

/**
 * 每晚一次：把當日（香港時間）已存檔嘅馬場天氣紀錄同步入 GitHub
 * 倉庫 sleepingarhat/tianxi-racing 嘅 data/weather/YYYY-MM.csv，
 * 令天氣同其他賽事資料集中喺同一個地方管理／回測。
 */
export const Route = createFileRoute("/api/public/weather-sync-github")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["WEATHER_CRON_SECRET"];
        if (!secret || request.headers.get("x-cron-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { syncWeatherDate, hkDateStr } = await import("@/lib/weather-sync-github.server");
        const url = new URL(request.url);
        const date = url.searchParams.get("date") ?? hkDateStr();
        const result = await syncWeatherDate(date);
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
    },
  },
});
