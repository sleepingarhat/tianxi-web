# src/lib rules

- Full racing health reads live in racing-health.server.ts; racingOps exposes only an allowlisted public projection and a role-checked admin RPC. Why: keep private diagnostics out of public responses and client modules.
- Weather sync URLs share handleWeatherSyncJob with managed auth and Hong Kong current date only. Why: prevent legacy shared secrets or query overrides from re-authorizing writes.

- Job heartbeats (`job_tick:*`, src/lib/job-ticks.ts registry) are read by the hourly sweep watchdog (`job-ticks-watch.server.ts`); a fail-status tick counts as alive — per-run failures keep using the dividends alert chain (updateDividendAlert). Why: heartbeat staleness means the cron stopped running, not that a run failed; duplicate failure alerts are noise.
