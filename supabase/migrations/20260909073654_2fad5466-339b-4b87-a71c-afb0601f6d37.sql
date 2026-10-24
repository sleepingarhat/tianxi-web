-- lovable-cron-fallback-reviewed: 288 runs/day; HKJC weather source exposes only live values with no history, so pre-race wind/rain/soil readings must be sampled every 5 minutes to build a backtestable archive
-- SECURITY REDACTION 2026-10-24: the shared secret that was previously embedded here as a
-- literal header has been removed from this file. It is now read at run time from Supabase
-- Vault (secret name: weather_cron_secret). The value that used to be committed remains in git
-- history and MUST be rotated (see PR "security-fixes-2026-10"). This legacy job is already
-- deactivated and replaced by the Lovable managed schedule; drizzle migration 0044 unschedules it.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'weather-archive-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--8be5fecb-440e-4e5c-94dc-cbdc1f31edcd-dev.lovable.app/api/public/weather-archive',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'weather_cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);