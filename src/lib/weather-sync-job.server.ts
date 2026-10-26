import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

/** Both sync URLs enforce exactly the same managed-job contract. */
export async function handleWeatherSyncJob(request: Request): Promise<Response> {
  const denied = await authenticateCronRequest(request);
  if (denied) return denied;
  try {
    const { syncWeatherDate, hkDateStr } = await import('./weather-sync-github.server');
    const result = await syncWeatherDate(hkDateStr());
    return Response.json(result, { status: result.ok ? 200 : 500 });
  } catch {
    return Response.json({ ok: false, error: 'weather-sync-failed' }, { status: 502 });
  }
}