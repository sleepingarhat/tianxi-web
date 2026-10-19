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
- 首頁流程只引用已定版或現行資料；理由：產品介紹必須可核對。
- 全站沿用 PageHead、Card、Stat、Table、Seg 與 AppShell；理由：避免逐頁漂移。
- Offers share FoundingMemberOffer/freeStage; Card headers use minmax text and fixed actions. Why: prevent offer drift and mobile badge wrapping.
- 功能頁桌面寬度按資料量調整，手機單欄；理由：提升密度而不破壞手機流程。
- 每次發布正式站後執行 python3 scripts/sync-frontend-repo.py，將源碼經 GitHub API 同步入 tianxi-web；理由：倉庫只作鏡像，正式站由 Lovable 發布。

## 監控端規則
- Read src/components/admin/AGENTS.md before changing that directory. Why: scoped rules apply.
- Public racing P&L supplements the existing four-pool rollup with shared `racingPoolAccounting` cross-race queries, merging daily cost and payout once; missing fifth picks are excluded and post-race substitutes are labelled, so incomplete data cannot masquerade as frozen results.
- Admin version notes must wrap in desktop tables and use stacked mobile records; cross-race trio reconciliation reuses ExoticTrioPools separately from the single-race strategy aggregate, to prevent truncated explanations and mixed accounting scopes.
- Blueprint audits separate code, verified flows, missing evidence and old decisions. Why: routes/tasks do not prove completion.

- 全站 break-ui 用 scripts/break-ui-matrix.py 覆蓋 320／390／1280、RTL、慢 API 與千人會員；dev-log 會合法提及 NaN／undefined，掃描器不可將說明文字當資料錯誤。理由：驗收要可重跑亦要避免假陽性。
- 外部圖片只可用逐張核實自由授權或書面商用權，頁內須署名並保留 /media-credits；API 圖址不等於授權。
- Current blueprint: docs/blueprint/tianxi-racing-blueprint-2026-10-13.md; changes sync blueprint, roadmap, AGENTS, dev-log and GitHub mirror; older versions cannot revive retired products. Why: docs match code; superseded plans remain historical.
- Pro entitlement is decided only by src/lib/entitlement.ts (resolveEntitlement), fed by the my_membership DB function and the webhook-maintained subscriptions table; the gate opens automatically at the 500th signup. Why: one rule source for free stage, founding Pro and paid subscriptions.
- Racecourse posters rotate weekly from Wikimedia Commons via a managed HTTP schedule into racecourse_photos (commercial-free licences only, auto-deactivate on licence change); tianxi-web GitHub Actions only monitor the public status endpoint. Why: scheduling stays in the app backend, GitHub mirror stays read-only.

- Homepage data-scale figures come only from racing_results_index, filled by a twice-daily job that counts each tianxi-racing results CSV incrementally (40 files/run). Why: shown numbers stay verifiable and update without manual edits.
- Racing coverage pages share racing-visibility aggregation over frozen hit-rate rows and full closing-result CSVs; position guides exclude same-day/future form and terminal finish positions. Why: paired denominators and pre-race evidence must remain auditable without prediction writes.
- RacePositionMap pairs historical medians with actual checkpoints, separates finish rank and expands sources; never label historical references frozen estimates.
- Racing evidence uses fixed read-only projections with settled/public-frozen eligibility. Separate current pedigree identities from original scores; missing snapshots remain unverified. Why: references cannot replace locked evidence.

- Retired sources/journals live only in private research with commits/checksums; detach runtime dependencies before removal. Keep only product-scope gates (redirect/410). Why: preserve research without shipping retired products.
- Race SSR/canonicals use public entries; sitemap pages by offset, fails incomplete reads and omits generated lastmod. Why: auditable discovery.

- Saved rebuild journals are not live jobs. Cohort tests fix features/Elo/rounds and exclude incomplete races; release gates require research evidence. Why: health PASS is not promotion approval.
- HKJC changes archive append-only (raw+SHA); they only label frozen withdrawals, never rewrite. Why: evidence-backed labels.
- Frozen API SELECTs originals, validates SHA/rows/meta and runner IDs against cards/results; missing fields stay null. Picks coalesce inflight; locked reads share API. Why: hashes prove integrity, not identity.

- Seed-aware replay preserves raw axes/full fields; pedigree ablation uses prior-date smoothing, seeded confidence, paired hit denominators and archived score/context checksums; no prediction writes. Why: exploratory parity cannot approve weight changes or certify historical locks.

- Scarce-start counts are advisory in prediction-status, not model switches or accounting filters. Why: display cannot invent exclusions.
