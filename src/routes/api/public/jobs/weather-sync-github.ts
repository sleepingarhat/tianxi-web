import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/jobs/weather-sync-github')({
  server: { handlers: {
    POST: async ({ request }) => {
      const { handleWeatherSyncJob } = await import('@/lib/weather-sync-job.server');
      return handleWeatherSyncJob(request);
    },
  } },
});