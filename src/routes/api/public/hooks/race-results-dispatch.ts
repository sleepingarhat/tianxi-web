import { createFileRoute } from "@tanstack/react-router";

/**
 * 準時觸發收賽果：GitHub 自帶排程常遲幾個鐘，改由後端定時任務準時
 * 呼叫 workflow_dispatch 觸發 capy_race_daily（完成後 capy_d1_sync 會自動接力）。
 * 非賽日由倉庫內 fixture_guard 自行跳過；已收齊嘅賽日按場號集合跳過，重跑安全。
 * 只觸發收料，唔改任何凍結預測。
 */
const REPO = "sleepingarhat/tianxi-racing";
const WORKFLOW = "capy_race_daily.yml";

export const Route = createFileRoute("/api/public/hooks/race-results-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["WEATHER_CRON_SECRET"];
        if (!secret || request.headers.get("x-cron-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const token = process.env["GITHUB_TOKEN"];
        if (!token) return Response.json({ ok: false, error: "未設定 GitHub token" }, { status: 500 });

        const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
          method: "POST",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "User-Agent": "tianxi-web",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ref: "main", inputs: { date: "", force: "n" } }),
          signal: AbortSignal.timeout(30_000),
        }).catch(() => null);
        if (!res) return Response.json({ ok: false, error: "賽果收料派送暫時未能確認" }, { status: 502 });
        if (!res.ok) {
          const body = await res.text();
          console.error(`race-results-dispatch failed [${res.status}]: ${body}`);
          return Response.json({ ok: false, status: res.status, error: "賽果收料派送未獲接納" }, { status: 502 });
        }
        return Response.json({ ok: true, workflow: WORKFLOW, dispatched_at: new Date().toISOString() });
      },
    },
  },
});
