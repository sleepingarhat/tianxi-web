import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

export const Route = createFileRoute('/api/public/jobs/race-results-dispatch')({
  server: { handlers: {
    POST: async ({ request }) => {
      const denied = await authenticateCronRequest(request);
      if (denied) return denied;
      const { dispatchRaceResults } = await import('@/lib/race-results-dispatch.server');
      return dispatchRaceResults();
    },
  } },
});