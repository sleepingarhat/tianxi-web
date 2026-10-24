<!-- LOVABLE:BEGIN -->
- Never rewrite published Git history; Lovable sync depends on it. Keep connected branches working.
<!-- LOVABLE:END -->



## 首頁產品層規則

- Homepage/navigation expose racing only; product-scope.ts and start.ts gate retired paths without executing them.
- Cite final/current homepage data only for verifiable claims.
- Reuse PageHead/Card/Stat/Table/Seg/AppShell for consistency.
- Share FoundingMemberOffer/freeStage; Card headers use minmax text/fixed actions to prevent wrapping.
- Desktop density; mobile one column.
- After publish run python3 scripts/sync-frontend-repo.py; tianxi-web mirrors source, Lovable hosts production.

## 監控端規則
- Before admin edits read src/components/admin/AGENTS.md.
- Ops logs use the shared read-only current-incident projection: latest gate evidence and live checks supersede history; API events are scoped to the Hong Kong day. Suppress stale odds alerts only with explicit live out-of-window evidence. Why: history is not current health and failed reads must stay visible.
- P&L/detail share exoticPoolOptions; verified ranks 1–5, original triples, duplicate stakes, sum dividends. Cron archives resultsall raw/SHA; trios prove losing tickets without inventing main payouts. Why: automatic auditable settlement.
- Admin notes wrap on desktop and stack on mobile; cross-race trio reconciliation uses ExoticTrioPools apart from single-race aggregates. Why: readable notes and separate accounting scopes.
- Audit real flows separately; starts need evidence, DNF is not withdrawal; actual/frozen jockey lineage stays separate.

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
- Racing evidence uses fixed read-only settled/public-frozen projections; current pedigrees stay separate from original scores, missing snapshots unverified. Why: references cannot certify locks.

- Retired sources/journals live only in private research with commits/checksums; keep only product-scope gates (redirect/410). Why: preserve research, don't ship retired products.
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

- Watch mutations authorize via loadUserTier and service-only atomic owner RPCs; apply limits only on limit transitions and isolate browser caches by user identity. Why: concurrent requests must not bypass caps, erase manual pauses or expose another account's collection.
- Horse-follow event reads verify ownership and tolerate unavailable upstream with private stored-event fallback; notification delivery and cleanup scheduling belong to the notification job. Why: missing synchronization is not evidence of no real horse activity.
- Member Telegram uses its dedicated bot, hashed single-use atomic link tokens and entitlement-approved join requests; engine-alert credentials are never substituted. Why: separate identities and owner-bound private-channel access.
- Notification jobs use durable leases, explicit raceday opt-in, stable per-owner event keys and verified final frozen picks; delivery timestamps follow provider success and failed delivery remains retryable. Why: concurrent jobs and missing evidence cannot imply delivery or authorize extra picks.
- Web Push uses bundled Web Crypto aes128gcm, owner-bound known-provider endpoints, and a same-origin notification-only service worker without fetch caches. Why: avoid SSRF, stale racing data and cross-account subscription takeover.
- Notification delivery renews owner-bound leases and persists per-event/device push receipts; Telegram unlink deletes only after server-side removal succeeds. Why: partial device failures stay retryable without resending accepted devices, and direct deletes cannot evade channel expiry.
- Crypto payments use signed SHA-512 IPNs, environment-bound orders and service-only atomic owner-locked grants; membership readers share the verified pass RPC. Why: browser returns, replayed callbacks and sandbox payments cannot independently grant production access.
- Notification limits persist pending notices until delivery succeeds; horse pushes batch per owner while tracking per-device receipts. Why: failed transition notices must remain retryable and multiple activities must not flood a device.
- Watch-limit transitions clear obsolete notices after restoration; raceday opt-in and delivery share a server-only release/configuration check. Why: stale notices and browser toggles cannot activate unavailable notifications.
- Managed HTTP schedules use structured Cloud tools only, never embedded credentials or hand-authored cron HTTP SQL; unpublished targets remain unscheduled. Why: platform-owned caller authentication and safe release ordering.
- Weather and legacy results-dispatch managed callbacks use separate jobs routes and shared server work; legacy routes retain their caller authentication until verified retirement. Why: unmanaged schedules cannot be automatically migrated and Worker callers must not break.
- Checkout must check the server gate timestamp independently of entitlement kind before provider access. Why: a failed subscription must never bypass a closed charging gate.
- Current repository summaries must supersede dated historical observations explicitly; never rewrite race evidence or applied migrations. Why: derived knowledge must not revive retired rules.
