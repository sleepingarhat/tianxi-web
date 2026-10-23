# 會員發布前七項修正（未發布）

## 已處理
1. 上限函式在開閘時計入創始52週、同付款環境的最新有效訂閱及通行證；先核會籍再套30／3／90。升級解除暫停時清除過期通知；發Telegram前重新數暫停馬匹，零匹即清待送旗標。
2. Pro掃描先查開閘，再查專用Bot及頻道設定；缺設定安全略過，不呼叫移除會員或到期通知。
3. 賽日提示共用伺服器上線檢查：旗標及VAPID／專用Bot至少一者可用。未上線不能登記、不展示選頻道、不從帳戶參數自動展開；工作安全略過。監控開關預設關閉，資料庫只接受boolean。
4. Crypto主價HK$3,244.80、原價HK$4,056.00、52週八折；副價約US$416，付款仍以USD結算，展示用×7.8及兩位小數。
5. 未建立新通知排程：原文件要求手寫pg_cron／pg_net及讀Vault，但本專案的已認證HTTP排程必須用Cloud結構工具；目標尚未發布，不可提前安排正式呼叫。沒有呼叫任何job endpoint。
6. 舊weather migration保持原狀；未輪換或重建舊排程。Feed優先讀WATCH_FEED_SECRET，其次WEATHER_CRON_SECRET。既有排程安全清單：weather-archive-5min＝*/5 * * * *；weather-sync-github-nightly＝50 15 * * *（UTC）。歷史migration有literal憑證風險；排程工具不返回command，現行是否仍含literal未核實，不披露值或command。
7. 測試採專用Vitest設定，排除兩個沒有測試套件的legacy task19檔，現行賽馬測試不排除。結果見最後驗證紀錄。

## 新變更及設定
- 0041_membership_watch_limits_and_raceday_release_gate：上限轉換、過期通知清除及raceday設定讀取／驗證。
- 0042_watch_limits_payment_environment_isolation：避免sandbox付款影響live資格。
- 缺少設定以ON CONFLICT DO NOTHING補齊，沒有覆蓋已有值；工具禁止純seed放migration，所以獨立資料操作。
- membership_payment_environment為伺服器設定；必須與現行付款環境一致，轉live時同步更新。未設定時sandbox，不跨環境合併付款。
- 沒有新增角色欄位；角色仍只在user_roles，管理員操作須伺服器驗證。

## 未完成／手動事項
- 尚未發布，未開閘、未開crypto_pass_enabled或raceday_alerts_enabled。
- 通知排程待十一份外部驗收及發布後才可建立：horse-watch每日01:30 UTC；raceday 02–15 UTC每5分鐘（168次／日，需解釋持續檢查成本）；telegram-pro-sweep每小時07分UTC。
- Vault名稱lovable_cron_secret、weather_cron_secret尚未設定；不要在對話貼密鑰。Cloud管理排程認證不由手寫Vault SQL代替。
- 若要保留原weather SQL排程，需先確認原預覽回呼網址可用，再透過受支援排程操作遷移；沒有把不確定網址改成正式站。
- 舊weather憑證有git歷史外洩風險，應透過安全Secret輸入輪換，再同步Lovable WEATHER_CRON_SECRET、Vault weather_cron_secret及Cloudflare Worker；單純刪除migration不能清除歷史。
- 會員Telegram／VAPID真實送達、NOWPayments sandbox付款、直接Worker Pro防護及自然排程仍未驗收。
## 最後驗證
- bunx vitest run：78個測試檔、427項全部通過；保留官方賽果13項與派彩解析4項等全部現行套件，沒有聲称另有19／8項不存在的套件。
- 平台自動typecheck及build：build OK；依平台禁止手動重跑型別／build指示，未另執行tsc --noEmit。
- 帳戶?raceday=1只讀畫面：顯示「收賽日提示（即將推出）」、未展開頻道、無page error；畫面登入狀態未建立，不能當真實會員端到端驗收。
- DB讀回30／3／90、crypto_pass_enabled=false、raceday_alerts_enabled=false；gate_open_at不存在。
- 未呼叫job、未改weather舊migration、未發布或開閘。
