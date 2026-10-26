# src/lib rules

- Job heartbeats (`job_tick:*`, src/lib/job-ticks.ts registry) are read by the hourly sweep watchdog (`job-ticks-watch.server.ts`); a fail-status tick counts as alive — per-run failures keep using the dividends alert chain (updateDividendAlert). Why: heartbeat staleness means the cron stopped running, not that a run failed; duplicate failure alerts are noise.
