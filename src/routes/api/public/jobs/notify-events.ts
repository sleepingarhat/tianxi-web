import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
export const Route = createFileRoute('/api/public/jobs/notify-events')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        try {
          const { runNotifyEventsJob } = await import('@/lib/notify-events-job.server');
          return Response.json(await runNotifyEventsJob());
        } catch {
          return Response.json({ ok: false, error: 'notify-events-failed' }, { status: 502 });
        }
      },
    },
  },
});
