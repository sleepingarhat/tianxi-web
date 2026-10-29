# src/lib rules

- With no lock-state date, locate past meetings through a bounded public lookup before live picks; verify original snapshot SHA/identity/venue and project tiers per request. Why: discardable live recomputation must not delay finished meetings.

- Strategy page and today PnL share useStrategyAccounting and combineStrategyAccounting; cross pools start at CROSS_POOL_START, only explicit no-archive HTTP responses skip reads, and failed reads suppress full totals. Why: avoid missing DT/TT or treating verification failure as zero.

- Official research uses fixed server-side D1 field allowlists and separate public DTOs with unavailable states; never prediction fields. Why: references cannot bypass membership or certify frozen inputs.
- All-unavailable official reference reads reject client queries for bounded retry, not successful ten-minute caching; individual unavailable sections remain explicit. Why: transient transport errors must not masquerade as empty records.
- Coverage RPC reads the last complete job-produced private cache snapshot and projects per viewer after reading; only managed refresh recomputes. Why: visitor detail reads must not fan out across half a year or leak cached member picks.

- Full racing health reads live in racing-health.server.ts; racingOps exposes only an allowlisted public projection and a role-checked admin RPC. Why: keep private diagnostics out of public responses and client modules.
- Weather sync URLs share handleWeatherSyncJob with managed auth and Hong Kong current date only. Why: prevent legacy shared secrets or query overrides from re-authorizing writes.

- Job heartbeats (`job_tick:*`, src/lib/job-ticks.ts registry) are read by the hourly sweep watchdog (`job-ticks-watch.server.ts`); a fail-status tick counts as alive — per-run failures keep using the dividends alert chain (updateDividendAlert). Why: heartbeat staleness means the cron stopped running, not that a run failed; duplicate failure alerts are noise.
