<!-- LOVABLE:BEGIN -->
- Never rewrite published Git history; Lovable sync depends on it. Keep connected branches working.
<!-- LOVABLE:END -->



## 首頁產品層規則

- Homepage/navigation expose racing only; product-scope.ts and start.ts gate retired paths without executing them.
- Cite final/current homepage data only for verifiable claims.
- Reuse PageHead/Card/Stat/Table/Seg/AppShell for consistency.
- Share FoundingMemberOffer/freeStage; Card headers use minmax text/fixed actions to prevent wrapping.
- Desktop density; mobile one column.
- After publishing run python3 scripts/sync-frontend-repo.py. Why: tianxi-web mirrors source; Lovable hosts production.

## 監控端規則
- Read nested src/components/admin/AGENTS.md before edits; scoped rules apply.
- P&L/detail share exoticPoolOptions/ExoticTrioPools; require verified ranks 1–5. Substitute per original triple; retain duplicate stakes, sum dividend rows, unknowns pending. Why: no changed picks or lost payouts.
- Admin notes wrap on desktop and stack on mobile; cross-race trio reconciliation uses ExoticTrioPools apart from single-race aggregates. Why: readable notes and separate accounting scopes.
- Audit real flows separately; starts need evidence, DNF is not withdrawal; actual/frozen jockey lineage stays separate.

- Run break-ui-matrix at 320/390/1280, RTL, slow API and 1000 members; ignore explanatory NaN/undefined copy. Why: repeatable checks without false positives.
- Images need commercial-free rights and /media-credits; URLs are not licences.
- Blueprint: docs/blueprint/tianxi-racing-blueprint-2026-10-13.md; sync blueprint/roadmap/AGENTS/dev-log/GitHub. Old plans cannot revive retired products. Why: docs match code.
- Pro uses only resolveEntitlement in src/lib/entitlement.ts, fed by my_membership and webhook-maintained subscriptions; auto-open at signup 500. Why: one free/founding/paid rule source.
- Weekly managed HTTP jobs rotate Commons posters into racecourse_photos; require commercial-free licences and deactivate licence changes. tianxi-web Actions only monitor public status. Why: backend schedules, read-only mirror.

- Homepage counts use only racing_results_index; twice-daily jobs count tianxi-racing results CSVs, 40 files/run. Why: verifiable automatic figures.
- Coverage shares racing-visibility frozen rows/full closing CSVs; guides exclude same-day/future form and finish positions. Why: auditable denominators and pre-race evidence, no prediction writes.
- RacePositionMap pairs historical medians and actual checkpoints, separates finish rank and cites sources; history is not frozen.
- Racing evidence uses fixed read-only settled/public-frozen projections; current pedigrees stay separate from original scores, missing snapshots unverified. Why: references cannot certify locks.

- Retired sources/journals live only in private research with commits/checksums; keep only product-scope gates (redirect/410). Why: preserve research, don't ship retired products.
- Race SSR/canonicals use public entries; sitemap pages by offset, fails incomplete reads and omits generated lastmod. Why: auditable discovery.

- Saved rebuild journals are not live jobs. Cohort tests fix features/Elo/rounds and exclude incomplete races; release gates require research evidence. Why: health PASS is not promotion approval.
- HKJC raw+SHA stays append-only; live notices overlay identity-matched withdrawals without changing frozen rows; no post-lock substitution. Cancellation keyword hits archive raw+SHA to hkjc_cancellation_snapshots. Why: notices cannot certify stale inputs.
- Frozen reads verify originals/SHA/meta/runner IDs. Fill only display metadata from meeting-matched cards; unknowns stay null, never merge scores. Locked picks coalesce. Why: references are not lock evidence.

- Replay preserves axes; pedigree uses prior-date smoothing. Family grids checkpoint input/script/versions/splits, finish before evaluation, save picks and paired corrected intervals; no production writes. Why: reproducibility is not promotion.

- Scarce starts never switch models.
- Billing reminders read subscriptions, dedupe after delivery; native alerts stay provider-owned. Not receipts.

- Gate card→recompute→freeze→settlement; results KPI uses frozen metricInput, never alternatives. Cloud results need identity/SHA/leases; dividends separate. D1 reads use linked server gateway. GitHub stays fallback. Why: preserve evidence and valid auth.
- Prelock leases/dedupe track revisions; unreadable picks allow dispatch, not recovery. Own card success gates recompute, not freeze.
- Coalesce picks reads with bounded deadlines; reject late data. Race pages use racePicksFromDay, not live topPicks. History keeps newest rows and reports truncation. Why: preserve evidence and recent dates.
- Parallel frozen reads block unknown timing; freeze-publication-window returns empty pending only for no-archive during T90→T60, never delays locks or hides verification errors. Why: waiting is not certification.
- racingClassLabel preserves labels.

- tx/Predictor* keeps guards; name cleanup requires matching ID, preserving archives.
- Ingestion retains dates/rows; child failures fail jobs. Backfill alerts name date/race. Why: absence ≠ cancellation.
