import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { isDispatchWorkflow, shouldDispatch } from "@/lib/racing-dispatch";

const REPO = "https://api.github.com/repos/sleepingarhat/tianxi-racing/actions/workflows";

export const Route = createFileRoute("/api/public/jobs/racing-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const body = (await request.json().catch(() => null)) as { workflow?: unknown } | null;
        const workflow = body?.workflow;
        if (!isDispatchWorkflow(workflow)) return Response.json({ ok: false, error: "workflow not allowed" }, { status: 400 });
        const token = process.env["GITHUB_TOKEN"];
        if (!token) return Response.json({ ok: false, error: "missing token" }, { status: 500 });
        const headers = { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "tianxi-web" };
        const runs = await fetch(`${REPO}/${workflow}/runs?per_page=1`, { headers, signal: AbortSignal.timeout(15_000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null) as { workflow_runs?: { created_at: string; status: string; conclusion: string | null }[] } | null;
        const latest = runs?.workflow_runs?.[0] ?? null;
        if (!shouldDispatch(latest, Date.now())) return Response.json({ ok: true, workflow, action: "skipped-github-on-time" });
        const res = await fetch(`${REPO}/${workflow}/dispatches`, { method: "POST", headers, body: JSON.stringify({ ref: "main" }), signal: AbortSignal.timeout(15_000) }).catch(() => null);
        const ok = res?.status === 204;
        if (!ok) {
          const { sendTelegramAlert } = await import("@/lib/telegramAlert.server");
          await sendTelegramAlert(`⚠️ 後端排程觸發失敗：${workflow}（GitHub 回應 ${res?.status ?? "無"}）。請檢查收料。`).catch(() => null);
        }
        return Response.json({ ok, workflow, action: "dispatched" }, { status: ok ? 200 : 502 });
      },
    },
  },
});
