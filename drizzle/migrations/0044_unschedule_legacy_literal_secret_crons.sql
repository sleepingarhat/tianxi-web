-- 2026-10-24 security: remove legacy pg_cron jobs whose stored command embedded a literal
-- shared-secret header (originally created by supabase/migrations/20260909073654_… and
-- 20260909094818_…; the race-results job was created the same way on the platform).
-- All three are already active=false and replaced by the Lovable managed schedules
-- weather-archive-managed / weather-sync-github-managed / race-results-dispatch-managed,
-- which authenticate with LOVABLE_CRON_SECRET and are NOT touched here.
-- Unscheduling deletes the row from cron.job, so the old literal no longer lives in the database.
-- Idempotent: skips silently when pg_cron is absent or a job no longer exists.
DO $$
DECLARE
  j record;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RETURN;
  END IF;
  FOR j IN
    SELECT jobid, jobname FROM cron.job
    WHERE jobname IN ('weather-archive-5min', 'weather-sync-github-nightly', 'race-results-dispatch')
  LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END
$$;
