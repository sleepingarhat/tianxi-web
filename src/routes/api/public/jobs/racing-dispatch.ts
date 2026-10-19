import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { isDispatchWorkflow, shouldDispatch } from "@/lib/racing-dispatch";
import { z } from "zod";

const REPO = "https://api.github.com/repos/sleepingarhat/tianxi-racing/actions/workflows";

export const Route = createFileRoute("/api/public/jobs/racing-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const body = z.object({ workflow: z.string().refine(isDispatchWorkflow) }).strict().safeParse(await request.json().catch(() => null));
        if (!body.success) return Response.json({ ok: false, error: "workflow not allowed" }, { status: 400 });
        const workflow = body.data.workflow;
        const token = process.env["GITHUB_TOKEN"];
        if (!token) return Response.json({ ok: false, error: "missing token" }, { status: 500 });
        const headers = { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "tianxi-web" };
        const runResponse = await fetch(`${REPO}/${workflow}/runs?per_page=1&branch=main`, { headers, signal: AbortSignal.timeout(15_000) }).catch(() => null);
        if (!runResponse?.ok) return Response.json({ ok: false, workflow, action: "stopped-run-status-unverified", providerStatus: runResponse?.status ?? null }, { status: 502 });
        const runs = z.object({ workflow_runs: z.array(z.object({ created_at: z.string().datetime(), status: z.enum(['queued', 'in_progress', 'completed', 'waiting', 'requested', 'pending']), conclusion: z.string().nullable() })) }).safeParse(await runResponse.json().catch(() => null));
        if (!runs.success) return Response.json({ ok: false, workflow, action: "stopped-run-status-unverified" }, { status: 502 });
        const latest = runs.data.workflow_runs[0] ?? null;
        if (!shouldDispatch(latest, Date.now())) return Response.json({ ok: true, workflow, action: "skipped-github-on-time" });
        const res = await fetch(`${REPO}/${workflow}/dispatches`, { method: "POST", headers, body: JSON.stringify({ ref: "main" }), signal: AbortSignal.timeout(15_000) }).catch(() => null);
        const ok = res?.status === 204;
        if (!ok) {
          const { sendTelegramAlert } = await import("@/lib/telegramAlert.server");
          await sendTelegramAlert(`⚠️ 後端排程觸發失敗：${workflow}（GitHub 回應 ${res?.status ?? "無"}）。請檢查收料。`).catch(() => null);
        }
        return Response.json({ ok, workflow, action: ok ? "dispatched" : "dispatch-failed", executor: "github-actions", deliveryVerified: false }, { status: ok ? 200 : 502 });
      },
    },
  },
});
