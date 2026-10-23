import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

export const Route = createFileRoute('/api/public/jobs/weather-sync-github')({
  server: { handlers: {
    POST: async ({ request }) => {
      const denied = await authenticateCronRequest(request);
      if (denied) return denied;
      try {
        const { syncWeatherDate, hkDateStr } = await import('@/lib/weather-sync-github.server');
        const result = await syncWeatherDate(hkDateStr());
        return Response.json(result, { status: result.ok ? 200 : 500 });
      } catch {
        return Response.json({ ok: false, error: 'weather-sync-failed' }, { status: 502 });
      }
    },
  } },
});