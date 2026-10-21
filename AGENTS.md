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
- P&L/detail share exoticPoolOptions/ExoticTrioPools; require verified ranks 1–5. Substitute per original triple; retain duplicate stakes, sum dividend rows, unknowns pending. Why: no changed picks or lost payouts.
- Admin notes wrap on desktop and stack on mobile; cross-race trio reconciliation uses ExoticTrioPools apart from single-race aggregates. Why: readable notes and separate accounting scopes.
- Audit real flows separately; starts need evidence, DNF is not withdrawal; actual/frozen jockey lineage stays separate.

- Run break-ui-matrix at 320/390/1280, RTL, slow API and 1000 members; ignore explanatory NaN/undefined copy. Why: repeatable checks without false positives.
- Images need commercial-free rights and /media-credits; URLs are not licences.
- Blueprint: docs/blueprint/tianxi-racing-blueprint-2026-10-13.md; sync blueprint/roadmap/AGENTS/dev-log/GitHub; old plans never revive retired products.
- Pro uses only resolveEntitlement in src/lib/entitlement.ts, fed by my_membership and webhook-maintained subscriptions; auto-open at signup 500. Why: one free/founding/paid rule source.
- Weekly managed HTTP jobs rotate Commons posters into racecourse_photos; commercial-free licences required, deactivate on licence changes. tianxi-web Actions only monitor public status (read-only mirror).

- Homepage counts use only racing_results_index; twice-daily jobs count tianxi-racing results CSVs, 40 files/run. Why: verifiable automatic figures.
- Coverage shares racing-visibility frozen rows/full closing CSVs; guides exclude same-day/future form and finish positions. Why: auditable denominators and pre-race evidence, no prediction writes.
- RacePositionMap pairs historical medians and actual checkpoints, separates finish rank and cites sources; history is not frozen.
- Racing evidence uses fixed read-only settled/public-frozen projections; current pedigrees stay separate from original scores, missing snapshots unverified. Why: references cannot certify locks.

- Retired sources/journals live only in private research with commits/checksums; keep only product-scope gates (redirect/410). Why: preserve research, don't ship retired products.
- Race SSR/canonicals use public entries; sitemap pages by offset, fails incomplete reads and omits generated lastmod. Why: auditable discovery.

- Rebuild journals ≠ live jobs. Cohort tests fix features/Elo/rounds, exclude incomplete races; release requires research evidence, not health PASS.
- HKJC raw+SHA stays append-only; live notices overlay identity-matched withdrawals without changing frozen rows; no post-lock substitution. Cancellation keyword hits archive raw+SHA to hkjc_cancellation_snapshots. Why: notices cannot certify stale inputs.
- Frozen reads verify originals/SHA/meta/runner IDs. Fill only display metadata from meeting-matched cards; unknowns stay null, never merge scores. Locked picks coalesce. Why: references are not lock evidence.

- Replay preserves axes; pedigree uses prior-date smoothing. Family grids checkpoint input/script/versions/splits, finish before evaluation, save picks and paired corrected intervals; no production writes. Why: reproducibility is not promotion.

- Scarce starts never switch models.
- Billing reads subscriptions; alerts dedupe after delivery, use private verified targets, never public fallback.

- Gate card→recompute→freeze→settlement; KPI uses frozen metricInput. Results need identity/SHA/leases; dividends separate. Existing callback verifies own run plus all official races. D1 uses linked gateway; GitHub fallback stays. Why: dispatch is not delivery.
- Prelock leases/dedupe track revisions; unreadable picks allow dispatch, not recovery. Own card success gates recompute, not freeze.
- Coalesce bounded picks reads, reject late data; race pages use racePicksFromDay. Summary: public rollups, same-meeting market aggregates, settled-version projections; coalesced memory/persisted cache, authenticated refresh bypasses TTL. On-demand details have independent deadlines/retries. Why: evidence without blocking first paint.
- Parallel frozen reads block unknown timing; freeze-publication-window: empty pending only for no-archive at T90→T60, never delay locks or hide verification errors. Why: waiting ≠ certification.
- racingClassLabel preserves labels.

- tx/Predictor* keeps guards; name cleanup requires matching ID, preserving archives.
- Ingestion retains dates/rows; child failures fail jobs. Backfill alerts name date/race. Why: absence ≠ cancellation.
