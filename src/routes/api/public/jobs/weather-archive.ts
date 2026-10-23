import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

export const Route = createFileRoute('/api/public/jobs/weather-archive')({
  server: { handlers: {
    POST: async ({ request }) => {
      const denied = await authenticateCronRequest(request);
      if (denied) return denied;
      try {
        const { runWeatherArchive } = await import('@/lib/weather-archive.server');
        // Managed calls cannot bypass the raceday window with query parameters.
        return await runWeatherArchive(new URL(request.url).origin);
      } catch {
        return Response.json({ ok: false, saved: 0, error: 'weather-archive-failed' }, { status: 502 });
      }
    },
  } },
});