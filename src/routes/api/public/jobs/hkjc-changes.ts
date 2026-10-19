import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/hkjc-changes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { captureHkjcChanges, readLatestHkjcChanges, recomputeIfStaleBeforeLock } = await import("@/lib/hkjc-changes.server");
        const result = await captureHkjcChanges();
        if (!result.ok) return Response.json(result, { status: 502 });
        const snap = await readLatestHkjcChanges(result.date);
        const precheck = await recomputeIfStaleBeforeLock((snap?.changes ?? []) as never, result.date).catch((e) => ({ action: "error", reason: String(e) }));
        return Response.json({ ...result, precheck });
      },
    },
  },
});
