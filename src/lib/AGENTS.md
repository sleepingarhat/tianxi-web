# src/lib rules

- With no lock-state date, locate past meetings through a bounded public lookup before live picks; verify original snapshot SHA/identity/venue and project tiers per request. Why: discardable live recomputation must not delay finished meetings.

- Strategy page and today PnL share useStrategyAccounting and combineStrategyAccounting; cross pools start at CROSS_POOL_START, only explicit no-archive HTTP responses skip reads, and failed reads suppress full totals. Why: avoid missing DT/TT or treating verification failure as zero.

- Official research uses fixed server-side D1 field allowlists and separate public DTOs with unavailable states; never prediction fields. Why: references cannot bypass membership or certify frozen inputs.
- First Wish racecard notes attach by cardBrand or cardHorseId; the bonus board keeps list horseNo and reserve. Why: a standby list number reuses a declared saddle and is not the official runner.
- All-unavailable official reference reads reject client queries for bounded retry, not successful ten-minute caching; individual unavailable sections remain explicit. Why: transient transport errors must not masquerade as empty records.
- Coverage RPC reads the last complete job-produced private cache snapshot and projects per viewer after reading; only managed refresh recomputes. Why: visitor detail reads must not fan out across half a year or leak cached member picks.

- Full racing health reads live in racing-health.server.ts; racingOps exposes only an allowlisted public projection and a role-checked admin RPC. Why: keep private diagnostics out of public responses and client modules.
- Weather sync URLs share handleWeatherSyncJob with managed auth and Hong Kong current date only. Why: prevent legacy shared secrets or query overrides from re-authorizing writes.

- Job heartbeats (`job_tick:*`, src/lib/job-ticks.ts registry) are read by the hourly sweep watchdog (`job-ticks-watch.server.ts`); a fail-status tick counts as alive — per-run failures keep using the dividends alert chain (updateDividendAlert). Why: heartbeat staleness means the cron stopped running, not that a run failed; duplicate failure alerts are noise.
- Stripe checkout/portal return URLs pass payment-return-url: live accepts only production origins, sandbox adds preview/localhost, checkout path is server-fixed; reject otherwise before any provider call. Why: callers must not turn billing redirects into open redirects.
- Official HKJC images and file links render only through official-records officialAssetUrl (host + path allowlist, image vs link), with referrerPolicy no-referrer and no proxying or re-hosting. Why: Worker rows are upstream data and must not become arbitrary image or link sources.
- Post-lock rebuilds (鎖後補建) only via tianxi-racing rebuild-post-lock-original.ts after owner approval; the label lives in snapshot provenance and pages read it through freeze-provenance.ts. Why: a late copy must never pass as an on-time original.
- After one successful SHA and card verification for a date, race-day polls reuse that in-memory snapshot and re-read only results, official changes and settlement inputs. Manual 重新核對 and `/api/public/frozen-racing` still verify every time. Gateway 429/503/971 retries use capped jitter and the page shows 「資料服務繁忙，請稍後再試」, never the response body. Why: a race-night poll must not re-hash or leak Cloudflare JSON, and a failed check must not invent top4 or SHA.
