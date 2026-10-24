import { createFileRoute } from "@tanstack/react-router";

/**
 * 每 5 分鐘存檔一次馬會馬場即時天氣（沙田／跑馬地／從化各一筆），
 * 為日後「風向×跑法」、「含水量×地質」等天氣特徵累積歷史樣本。
 * 由排程以 x-cron-secret 呼叫；GET 只讀最近存檔數量。
 */
export const Route = createFileRoute("/api/public/weather-archive")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireSharedSecret, weatherHookSecrets } = await import("@/lib/shared-secret.server");
        const denied = requireSharedSecret(request, weatherHookSecrets());
        if (denied) return denied;
        const { runWeatherArchive } = await import("@/lib/weather-archive.server");
        const url = new URL(request.url);
        return runWeatherArchive(url.origin, url.searchParams.get("force") === "1");
      },
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { count } = await supabaseAdmin
          .from("weather_snapshots")
          .select("id", { count: "exact", head: true });
        return Response.json({ total: count ?? 0 });
      },
    },
  },
});
