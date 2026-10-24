# 正式排位收料修復核對（2026-10-24）

## 背景
- 馬會由 2026-10-23 起以 WHITELIST_ERROR 拒絕通用 hkjc-api 查詢；`capy_racecard` 照報成功但實際寫「no active meeting」——正式排位收料靜靜失敗。
- 同日發現 `scrape-racecard.ts` 疑似將馬匹體重（`currentWeight`，約 900–1300 磅）寫入 `entries_upcoming.actual_weight`（預測特徵當負磅用）。

## 歷史核對（先證實，後修改）
- 範圍：tianxi-racing 倉 `data/2026/results_*.csv` 共 944 份、111,211 行。
- `actual_wt_lbs` 介乎 103–135（中位 124）＝實際負磅；`declared_wt_lbs` 介乎 856–1503（中位 1117）＝排位體重。
- 結論：賽果收料（RacingData_Scraper.py）欄位正確；調轉只發生喺排位收料（scrape-racecard.ts）。歷史賽果同凍結紀錄無需修改。

## 修正內容（tianxi-racing `81f6c8d`）
1. 新增共用庫 `backend/scripts/ingest/lib/hkjc-racecard.ts`：白名單 GraphQL 查詢、本地排位過濾、`mapWeights`（負磅＝handicapWeight、實際負磅＝負磅−見習減磅、體重唔寫入負磅欄位）。
2. `scrape-racecard.ts`、`scrape-odds.ts` 改用新查詢；馬會拒絕時工作失敗，唔會當冇賽事。
3. 白名單查詢冇場次級資料（加欄位即被 WHITELIST_ERROR 拒絕）；新增 `racecard-meta.ts` 由公開排位頁 RaceCard.aspx 解析開跑時間、距離、途程、賽道、場地、班次，附身份守衛（日期／場地／場次唔啱即拒收）。
4. upsert 改用 COALESCE：排位頁解析失敗時保留資料庫現有值，唔會寫空。
5. `/api/meetings` 後備路徑 `weight` 改用 `declared_weight ?? actual_weight`，唔再將體重當負磅顯示。

## 驗證
- `test-hkjc-racecard.ts`、`test-racecard-meta.ts`、`test-racecard-snapshot.ts` 全部通過；`tsc --noEmit` 零錯誤。
- 2026-10-25 沙田完整試跑（臨時資料庫）：11 場 156 匹，鎖前剔走 2 匹官方退出，140 行寫入；負磅 122–132、開跑時間 ISO+08:00、距離、班次（第四班／第三班）、場地（好地）全部正確。
- 後端 Cloudflare 部署由 GitHub Actions 自動觸發（`81f6c8d`）。

## 未做／邊界
- 舊凍結、歷史賽果不改。
- 網站未發布（今次只改後端收料，前端無改動）。
- D1 現存嘅舊排位列如曾被調轉寫入，會喺下次收料時被正確值覆蓋（upsert）；唔做歷史 D1 回填。
- B（場地軟硬度讀數）未開始。
