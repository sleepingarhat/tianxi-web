import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/hkjc-changes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { captureHkjcChanges } = await import("@/lib/hkjc-changes.server");
        const result = await captureHkjcChanges();
        return Response.json(result, { status: result.ok ? 200 : 502 });
      },
    },
  },
});
