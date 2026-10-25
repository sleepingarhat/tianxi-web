# Worker 網站唯讀讀取補漏（2026-10-25）

## 範圍與狀態
- 本輪未發布，等待用戶覆核批准。
- 按新指示透過安全表單更新 SITE_READER_TOKEN；值未讀取、未比較、未寫入檔案。
- 未改任何Worker模式、會員收費閘、Crypto或賽日提示。
- 用戶確認 #90 已還原兩個匿名模式 legacy；Cloudflare 新憑證11:42部署。這是用戶提供的現況，不代表本輪已驗證兩邊一致。

## 全倉檢查與入口清單
檢查 TX_BASE、WORKER、WORKER_BASE 模板及 today-picks／hit-rate 字面值和 URL 變數。

### 本輪修改（四個呼叫位置）
| 檔案／函式 | 端點 | 保留條件 |
|---|---|---|
| src/lib/racing-evidence.functions.ts / getLockedEvidence | today-picks | no-store、15秒、非Pro第1場、公開frozen與原SHA／身份核實；不帶admin，Pro不呼叫Worker |
| src/lib/hkjc-changes.server.ts / recomputeIfStaleBeforeLock.read | today-picks、可選fresh=1 | no-store、一般15秒／fresh45秒、既有admin header及fresh憑證前置條件、工作鎖與鎖前流程 |
| src/lib/picks.functions.ts / fetchTodayPicksUpstream | today-picks | no-store、40秒、原admin header／user-agent；鎖後仍讀已核實原副本 |
| src/lib/picks.functions.ts / getOraclePicks | today-picks、可選fresh=1 | 既有登入middleware、server admin角色核實、admin header／user-agent；原本沒有cache或timeout設定，未新增或刪除 |

### 原本已用 workerFetch（無需修改）
| 檔案 | 讀取 |
|---|---|
| src/lib/hit-rate.functions.ts | getMeetingHitRate → hit-rate |
| src/lib/coverage-audit.server.ts | readJson → hit-rate-rollup、hit-rate |
| src/lib/racing-visibility.functions.ts | getValueComparison.readJson → hit-rate-rollup、hit-rate |
| src/lib/racingOps.functions.ts | 會員授權後讀 hit-rate-rollup、hit-rate |
| src/lib/track-record-summary.server.ts | hit-rate-rollup |

沒有其他需修改的伺服器 today-picks／hit-rate 呼叫。lock-state、draw-tune、GitHub賽果CSV不在本輪指定端點範圍，未改；tx-api.ts 的公開rollup包裝及無呼叫者的todayPicks包裝不是伺服器端讀取，未改。

## 測試
- site-reader.server.test.ts 新增6項，直接執行實際讀取函式，斷言四個入口（含兩個fresh分支）實際fetch收到 X-Tianxi-Site-Token；核對原cache／timeout、admin header保持及非Pro解釋不帶admin。
- racing-evidence.functions.test.ts 明確stub空網站憑證，避免測試依賴真實環境；仍核對無admin、免費第2場null、Pro不讀Worker、原副本不符拒絕。
- bunx vitest run：91個測試檔、548項全部通過（原542項＋6項）。
- 新增讀取路徑的預覽自動編譯結果為build OK；沒有手動build或typecheck。
- 以上為隔離的請求流程測試，未觸發真實重算、通知或凍結寫入；兩邊憑證一致性及restricted環境真實頁面驗收待用戶預覽安排，未冒稱通過。

## 本輪改動檔案（10個；無刪除）
1. src/lib/racing-evidence.functions.ts
2. src/lib/hkjc-changes.server.ts
3. src/lib/picks.functions.ts
4. src/lib/site-reader.server.test.ts
5. src/lib/racing-evidence.functions.test.ts
6. roadmap.md
7. AGENTS.md
8. src/routes/dev-log.tsx
9. docs/blueprint/tianxi-racing-blueprint-2026-10-13.md
10. docs/reviews/worker-reader-audit-2026-10-25.md（新增）

另有安全表單更新既有secret，並非程式檔案；本輪清單不代表未來Publish相對正式版本的完整差異，發布前須重新核對。