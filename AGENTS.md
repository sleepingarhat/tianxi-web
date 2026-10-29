<!-- LOVABLE:BEGIN -->
- Never rewrite published Git history; Lovable sync depends on it. Keep connected branches working.
<!-- LOVABLE:END -->



## 首頁產品層規則

- Racing-only nav; product-scope.ts/start.ts block retired execution (redirect/410); research stays private with commit/SHA. Why: preserve research.
- Cite final/current homepage data only for verifiable claims.
- Reuse PageHead/Card/Stat/Table/Seg/AppShell; AppShell owns non-home back/home-fallback and encyclopedia links. Why: consistent navigation.
- Share FoundingMemberOffer/freeStage; Card headers use minmax text/fixed actions to prevent wrapping.
- Desktop density; mobile one column.
- Publish: run scripts/sync-frontend-repo.py. Pinned imports: approved removals only; preserve env/generated; no implicit migration/publish. Retired lab routes redirect /lab. Why: safe sync.

## 監控端規則
- Read nested AGENTS.md before edits: src/components/admin (admin panels), src/lib (libs).
- Overview/logs share current-incident projection: workflows, alerts, checks and read errors; live gate evidence supersedes history; API events use HK day; stale odds suppression needs live out-of-window evidence. Why: one visible failure scope.

- Run break-ui-matrix at 320/390/1280, RTL, slow API and 1000 members; ignore explanatory NaN/undefined copy. Why: repeatable checks without false positives.
- Images need commercial-free rights and /media-credits; URLs are not licences.
- Blueprint: docs/blueprint/tianxi-racing-blueprint-2026-10-13.md; sync blueprint/roadmap/AGENTS/dev-log/GitHub; old plans never revive retired products.
- Pro uses only resolveEntitlement fed by my_membership and verified payment records; app_settings supplies the gate threshold and founding cap is locked once at opening. Why: one server-authoritative membership rule source.
- Tier middleware must authorize protected reads server-side, including direct Worker entrypoints; public historical audit projections stay public. Why: open source transparency is not access control.
- Membership views share tier-projection for permitted rows and field sets; DEV tier preview may only downgrade the UI, never grant server access. Why: hidden picks must not enter rendered markup and acceptance must not change real membership.
- Membership setting actions verify the current admin role server-side and use the existing settings RLS and gate RPC; the admin panel never grants membership itself. Why: editing the UI cannot escalate privileges or rewrite the locked founding cap.
- Weekly managed HTTP jobs rotate Commons posters into racecourse_photos; commercial-free licences required, deactivate on licence changes. tianxi-web Actions only monitor public status (read-only mirror).

- Homepage counts use only racing_results_index; twice-daily jobs count tianxi-racing results CSVs, 40 files/run. Why: verifiable automatic figures.
- Coverage shares racing-visibility frozen rows/full closing CSVs; guides exclude same-day/future form and finish positions. Why: auditable denominators and pre-race evidence, no prediction writes.
- RacePositionMap pairs historical medians and actual checkpoints, separates finish rank and cites sources; history is not frozen.
- Server today-picks/hit-rate reads use workerFetch, including evidence, prelock and admin/fresh paths; preserve admin authorization and timeouts. It attaches the read-only site token only to Worker URLs; browsers never call hit-rate directly and tier projection runs after shared caches. Why: restricted anonymous modes must not break reads or grant privileges.
- Racing evidence reads match canonical date/venue/race/horse without requiring settled race rows; pre-race scores need the verified original snapshot (SHA, lock passed, baseline). Pro is authorized server-side and reads no Worker/admin edition; non-Pro also needs the public frozen picks. Isolate browser caches by user; pedigrees stay separate. Why: admin editions are live, not frozen.

- Race SSR/canonicals use public entries; sitemap pages by offset, fails incomplete reads and omits generated lastmod. Why: auditable discovery.

- Rebuild journals ≠ live jobs. Cohort tests fix features/Elo/rounds, exclude incomplete races; release requires research evidence, not health PASS.
- HKJC raw+SHA stays append-only; live notices overlay identity-matched withdrawals without changing frozen rows; no post-lock substitution. Cancellation keyword hits archive raw+SHA to hkjc_cancellation_snapshots. Why: notices cannot certify stale inputs.
- Frozen reads verify SHA/meta/IDs; unnumbered nonfinishers need unique dated prelock notices. Match pool withdrawals by frozen name/ID, not slot. Metadata only; never merge scores. Why: replacements are not scratches.

- Replay preserves axes; pedigree uses prior-date smoothing. Grids checkpoint inputs/versions/splits, finish before evaluation; save picks/paired intervals, no production writes. Why: reproducibility ≠ promotion.

- Scarce starts never switch models.
- Billing reads subscriptions; alerts dedupe after delivery, use private verified targets, never public fallback.

- Gate card→recompute→freeze→settlement; KPI uses frozen metricInput. Results need identity/SHA/leases; dividends separate. Existing callback verifies own run plus all official races. D1 uses linked gateway; GitHub fallback stays. Why: dispatch is not delivery.
- Prelock leases/dedupe track revisions; unreadable picks allow dispatch, not recovery. Own card success gates recompute, not freeze.
- Coalesce picks reads; race pages use racePicksFromDay. Summary SSR reads one public complete snapshot; authenticated hourly refresh alone publishes rollups, paired markets and settled versions. Failed refresh retains dated snapshot; details have independent deadlines/retries. Why: no visitor-triggered heavy work.
- Parallel frozen reads block unknown timing; freeze-publication-window: empty pending only for no-archive at T90→T60, never delay locks or hide verification errors. Why: waiting ≠ certification.
- racingClassLabel preserves labels.

- tx/Predictor* keeps guards; name cleanup requires matching ID, preserving archives.
- Ingestion retains dates/rows; child failures fail jobs. Backfill alerts name date/race. Why: absence ≠ cancellation.
- Research archives verify official meeting/horse identities and append-only raw/CSV SHA; track views are derived, incident addenda stay unassigned without links, and as-of readers require prior-date evidence captured before cutoff. Why: latest or post-race evidence cannot certify original pre-race inputs.

- Watch mutations authorize via loadUserTier and service-only atomic owner RPCs; apply limits only on limit transitions and isolate browser caches by user identity. Why: concurrent requests must not bypass caps, erase manual pauses or expose another account's collection.
- Horse-follow event reads verify ownership and tolerate unavailable upstream with private stored-event fallback; notification delivery and cleanup scheduling belong to the notification job. Why: missing synchronization is not evidence of no real horse activity.
- Member Telegram uses its dedicated bot, hashed single-use atomic link tokens and entitlement-approved join requests; engine-alert credentials are never substituted. Why: separate identities and owner-bound private-channel access.
- Notification jobs use durable owner-bound leases, raceday opt-in, stable per-owner event keys and verified frozen picks; delivery timestamps follow provider success, per-device receipts persist, horse pushes batch per owner, failures stay retryable. Why: concurrency and missing evidence cannot imply delivery or resend accepted devices.
- Web Push uses bundled Web Crypto aes128gcm, owner-bound known-provider endpoints, and a same-origin notification-only service worker without fetch caches. Why: avoid SSRF, stale racing data and cross-account subscription takeover.
- Telegram unlink deletes only after server-side removal; pending notices persist until delivery; watch-limit restoration clears obsolete notices; raceday opt-in/delivery share a server-only release check. Why: direct deletes cannot evade channel expiry; stale notices or browser toggles cannot activate notifications.
- Crypto payments use signed SHA-512 IPNs, environment-bound orders and service-only atomic owner-locked grants; membership readers share the verified pass RPC. Why: browser returns, replayed callbacks and sandbox payments cannot independently grant production access.
- Live payment acceptance uses an admin-only isolated receipt ledger and callback, never the Pro grant ledger. Why: small verification payments cannot grant full membership or open public sales.
- Managed HTTP schedules use structured Cloud tools only, never embedded credentials or hand-authored cron HTTP SQL; unpublished targets remain unscheduled. Why: platform-owned caller authentication and safe release ordering.
- Weather/results jobs share work; legacy weather-sync uses managed auth, other Worker hooks retain auth. Why: retired sync cannot retain shared-secret write authority.
- Health is status-only; diagnostics need admin role. Public draw-tune returns 410; research uses admin RPC. Why: prevent privileged proxying and alert leaks. Read src/lib/AGENTS.md.
- Checkout must check the server gate timestamp independently of entitlement kind before provider access. Why: a failed subscription must never bypass a closed charging gate.
- Current summaries explicitly supersede dated observations; never rewrite race evidence/applied migrations. Why: history cannot revive retired rules.
- Cross-repo audits use docs/repository-policy.json, pinned default-branch commits, explicit historical scopes and fail-closed reads; only racing hosts the hourly read-only audit. Why: detect drift without rewriting evidence or duplicate mirror jobs.
- Results verify displayed 賽事日期 before writes; fallback pages stay pending. RESULT race timeouts always alert; meeting/job suppression requires nonempty valid future starts. Why: fallback pages and missing D1 timing certify neither identity nor pre-race status.

- Reconciliation HTTP/RPC uses server-verified guest result-only allowlists; raw frozen readers stay internal, members send bearer auth, identity changes clear private caches. Why: alternate endpoints/caches cannot bypass hidden-race protection.
