<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->



## 首頁產品層規則

- Homepage/navigation expose racing only; product-scope.ts and start.ts gate retired paths without executing them.
- Cite final/current homepage data only. Why: verifiable claims.
- Reuse PageHead, Card, Stat, Table, Seg, AppShell. Why: consistency.
- Share FoundingMemberOffer/freeStage; Card headers use minmax text/fixed actions. Why: consistent offers, no wrapping.
- Desktop width follows data density; mobile single column. Why: readability.
- After publishing run python3 scripts/sync-frontend-repo.py. Why: tianxi-web mirrors source; Lovable hosts production.

## 監控端規則
- Read src/components/admin/AGENTS.md before changing that directory. Why: scoped rules apply.
- Public P&L combines four-pool rollups with `racingPoolAccounting` cross-race queries; merge daily cost/payout once, exclude missing fifth picks and label post-race substitutes. Why: incomplete data is not frozen evidence.
- Admin notes wrap on desktop and stack on mobile; cross-race trio reconciliation uses ExoticTrioPools apart from single-race aggregates. Why: readable notes and separate accounting scopes.
- Audits separate code, verified flows, missing evidence and old decisions. Why: tasks cannot prove delivery.

- Run break-ui-matrix at 320/390/1280, RTL, slow API and 1000 members; ignore explanatory NaN/undefined copy. Why: repeatable checks without false positives.
- Images need verified free commercial licences or written rights, attribution and /media-credits. Why: API URLs are not licences.
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
- HKJC raw+SHA stays append-only; live notices overlay identity-matched withdrawals without changing frozen rows; only post-lock substitutions are valid. Why: fresh notices cannot certify stale inputs.
- Frozen reads verify originals/SHA/meta/runner IDs. Fill only display metadata from meeting-matched cards; unknowns stay null, never merge scores. Locked picks coalesce. Why: references are not lock evidence.

- Replay preserves raw axes/fields; pedigree tests use prior-date smoothing, seeded confidence, paired denominators and score/context checksums, no prediction writes. Why: research cannot certify locks or approve weights.

- Scarce starts only advise status, never switch models/accounting. Why: no invented exclusions.
- Billing reminders read linked subscriptions; dedupe only after delivery. Native balance alerts remain provider-owned. Why: reminders are not receipts.

- Gate card→recompute→freeze→settlement; results KPI uses frozen metricInput, never alternatives. Cloud results need identity/SHA/leases; dividends separate. D1 reads use linked server gateway. GitHub stays fallback. Why: preserve evidence and valid auth.
- Dispatch checks main fail-closed, never duplicates active jobs or certifies delivery. Why: safe retries.
- Picks refresh coalesces active reads with a bounded deadline; timeouts release retry without accepting late data. Race pages read only verified frozen picks via racePicksFromDay, never legacy live topPicks. Why: one auditable source; hangs must not certify stale picks.
- Parallelize independent frozen reads; bound optional references without bypassing evidence checks. Why: avoid display delays.
- Preserve official class labels through racingClassLabel. Why: Chinese and Group labels are valid.
