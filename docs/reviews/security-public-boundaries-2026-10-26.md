# 安全修復 #1／#4／#5 候選驗證（未發布）

## 範圍
- #1 公開 draw-tune 改410，任何query不觸發上游；既有runDrawTune登入＋admin role守衛保留，不採臨時限流。
- #4 完整讀取移至racing-health.server；公開RPC明確白名單只留狀態／公開workflow／已登記心跳／告警數。內部告警文字、key、送達時間、Telegram身份／診斷及未登記job不回瀏覽器。管理員另用requireSupabaseAuth及user_roles核實的RPC，讀取前拒絕無角色／查詢失敗。
- #5 兩個weather-sync URL共用handleWeatherSyncJob，authenticateCronRequest先行；只用香港當日，不接受共享weather header或date覆寫。其他weather/results Worker hooks不改。
- #2 Stripe返回網址allowlist留收費閘前；修時再覆核ownership。#3用戶核實誤報，不獨立修。

## 已驗證
- 三個安全測試檔15項通過；全套99檔593項通過，平台最新build OK。
- Chromium預覽1280×1800真實健康讀取：心跳卡正常、Telegram接通、無公開job ID或私人Bot名稱，無pageerror。首次兩次等待卡文字逾時；再讀真實頁面成功，不將逾時當健康故障或認證通過。
- 預覽draw-tune HTTP410，新舊weather-sync未授權均401；沒有執行授權同步寫入或逼發TG。
- 獨立read-only code review無新增可利用漏洞；確認公開workflow名稱／時間及告警數仍按設計公開，rotation previous secret不在本輪變更。

## 待Verifier
- PR diff對照570af27；真管理員登入完整診斷讀回及非管理員直接RPC拒絕尚待真實session驗收。mock角色測試不可代替登入驗收。
- 未修改八項公開資料表政策、密鑰、排程、開關、凍結或收費閘；不Publish、不merge、不直接同步main。