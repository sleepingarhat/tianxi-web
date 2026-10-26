import { createFileRoute } from "@tanstack/react-router";

/**
 * Legacy URL is an alias of the managed job, including its platform auth.
 * No shared weather secret or arbitrary-date override is accepted here.
 */
export const Route = createFileRoute("/api/public/weather-sync-github")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleWeatherSyncJob } = await import('@/lib/weather-sync-job.server');
        return handleWeatherSyncJob(request);
      },
    },
  },
});
