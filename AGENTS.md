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
- Public P&L combines four-pool rollups with `racingPoolAccounting` cross-race queries; merge daily cost/payout once, exclude missing fifth picks and label post-race substitutes. Why: incomplete data is not frozen evidence.
- Admin notes wrap on desktop and stack on mobile; cross-race trio reconciliation uses ExoticTrioPools apart from single-race aggregates. Why: readable notes and separate accounting scopes.
- Audits separate code, verified flows, missing evidence and old decisions. Why: tasks cannot prove delivery.

- 全站 break-ui 用 scripts/break-ui-matrix.py 覆蓋 320／390／1280、RTL、慢 API 與千人會員；dev-log 會合法提及 NaN／undefined，掃描器不可將說明文字當資料錯誤。理由：驗收要可重跑亦要避免假陽性。
- 外部圖片只可用逐張核實自由授權或書面商用權，頁內須署名並保留 /media-credits；API 圖址不等於授權。
- Current blueprint: docs/blueprint/tianxi-racing-blueprint-2026-10-13.md; changes sync blueprint, roadmap, AGENTS, dev-log and GitHub mirror; older versions cannot revive retired products. Why: docs match code; superseded plans remain historical.
- Pro entitlement is decided only by src/lib/entitlement.ts (resolveEntitlement), fed by the my_membership DB function and the webhook-maintained subscriptions table; the gate opens automatically at the 500th signup. Why: one rule source for free stage, founding Pro and paid subscriptions.
- Weekly managed HTTP jobs rotate Commons posters into racecourse_photos; require commercial-free licences and deactivate licence changes. tianxi-web Actions only monitor public status. Why: backend schedules, read-only mirror.

- Homepage data-scale figures come only from racing_results_index, filled by a twice-daily job that counts each tianxi-racing results CSV incrementally (40 files/run). Why: shown numbers stay verifiable and update without manual edits.
- Racing coverage pages share racing-visibility aggregation over frozen hit-rate rows and full closing-result CSVs; position guides exclude same-day/future form and terminal finish positions. Why: paired denominators and pre-race evidence must remain auditable without prediction writes.
- RacePositionMap pairs historical medians and actual checkpoints, separates finish rank and cites sources; history is not frozen.
- Racing evidence uses fixed read-only projections with settled/public-frozen eligibility. Separate current pedigree identities from original scores; missing snapshots remain unverified. Why: references cannot replace locked evidence.

- Retired sources/journals live only in private research with commits/checksums; detach runtime dependencies before removal. Keep only product-scope gates (redirect/410). Why: preserve research without shipping retired products.
- Race SSR/canonicals use public entries; sitemap pages by offset, fails incomplete reads and omits generated lastmod. Why: auditable discovery.

- Saved rebuild journals are not live jobs. Cohort tests fix features/Elo/rounds and exclude incomplete races; release gates require research evidence. Why: health PASS is not promotion approval.
- HKJC raw+SHA stays append-only; live notices share polling and overlay identity-matched withdrawals without changing frozen rows. Only post-lock substitutions are valid. Why: fresh notices cannot certify stale inputs.
- Frozen reads verify originals/SHA/meta/runner IDs. Fill only display metadata from meeting-matched cards; unknowns stay null, never merge scores. Locked picks coalesce. Why: references are not lock evidence.

- Seed-aware replay preserves raw axes/full fields; pedigree ablation uses prior-date smoothing, seeded confidence, paired hit denominators and archived score/context checksums; no prediction writes. Why: exploratory parity cannot approve weight changes or certify historical locks.

- Scarce-start counts only advise prediction-status, never switch models or filter accounting. Why: no invented exclusions.

- Gate card→recompute→freeze→settlement; originals feed KPI/P&L. GitHub fallback needs compatible compute. Persist official completion/dispatch leases; null-slot results require withdrawn identity/no placing. Why: no guessed times or rebets.
