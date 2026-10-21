import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Telegram 告警手動／定時觸發端點（POST，x-cron-secret 保護）。
 * 檢查範圍：數據庫健康、賽馬同步、凍結及原始副本完整性。
 * 只報不修：唔會改任何凍結數值、帳本或鎖定資料。
 * ?test=1 會另外發一條測試訊息，用嚟核對 Bot 通道。
 */
export const Route = createFileRoute("/api/public/telegram-alert")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["WEATHER_CRON_SECRET"];
        if (!secret || request.headers.get("x-cron-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        const url = new URL(request.url);
        const test = url.searchParams.get("test") === "1";
        const { runAlertChecks, sendTelegramAlert } = await import("@/lib/telegramAlert.server");
        if (request.headers.get("content-type")?.includes("application/json")) {
          const input = await request.json().catch(() => null);
          const odds = z.object({ kind: z.literal('odds-stale'), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), races: z.array(z.number().int().min(1).max(12)).min(1).max(12) }).safeParse(input);
          if (odds.success) {
            const result = await sendTelegramAlert(`天喜市場盤口告警 · ${odds.data.date}\n第${odds.data.races.join('、')}場賠率超過20分鐘未更新或缺快照；只影響市場對照，原四揀及模型不變。`);
            return Response.json({ sent: result.sent }, { status: result.sent ? 200 : 503 });
          }
          const parsed = z.object({ kind: z.literal("freeze-recovery"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), action: z.enum(["blocked", "restored-original"]), restored: z.number().int().min(0).max(300), error: z.string().max(160).nullable() }).safeParse(input);
          if (!parsed.success) return Response.json({ sent: false, detail: "invalid-event" }, { status: 400 });
          const event = parsed.data;
          const result = await sendTelegramAlert(`天喜凍結巡查 · ${event.date}\n${event.action === "blocked" ? "已阻截：原始預測不一致，未覆寫任何分數。" : `已按原始副本恢復 ${event.restored} 行並核對一致。`}\n${event.error ? `故障：${event.error}\n` : ""}核對：https://tianxi.racing/model`);
          return Response.json({ sent: result.sent }, { status: result.sent ? 200 : 503 });
        }
        const result = await runAlertChecks("cron");
        let testResult: unknown = null;
        if (test) testResult = await sendTelegramAlert("天喜引擎告警通道測試：收到呢條訊息即代表告警已接通。");
        return Response.json({ ...result, test: testResult });
      },
    },
  },
});
