# 第四、第五、第六份接續核對（未發布）

## 本輪可完成範圍
- 第四份：独立會員Bot連結、單次雜湊token、私人Pro批核／到期移除、愛駒事件來源讀取、按現行偏好過濾、送出後去重及監控工作紀錄。會員Bot沒有挪用引擎告警Bot。
- 第五份：主畫面manifest及maskable圖、不快取頁面/API的service worker、Web Crypto推送、本人裝置限制、明確選擇收賽日提示、只發已核實最終凍結版。逐裝置receipt讓局部失敗重試而不重發成功裝置；工作鎖續期失敗立即停。
- 第六份：舊方案假資料及欄位清理、動態創始名額與零名額隱藏、會員頁保留Stripe週費並先隱藏未接收款Crypto；不改checkout及portal。

## 實際驗證
- 全套75個測試檔、392項通過；最新網站檢查build OK。
- 本人登入/account切換「收賽日提示」→儲存→刷新讀回→還原；未修改真實會籍或開閘。
- /my-horses在320／390／1280無橫向溢出；修正新增帳戶入口造成細屏导航擠出。
- 159次全站矩陣，包括RTL、慢API及既有1000會員worst fixture設定，無失敗；fixture是模擬，不是真實1000會員運行量。
- 管理員Telegram面板如實顯示會員Bot未設，設定按鈕不可用。
- 三個job無認證401；受認證Pro sweep回gate_not_open、horse-watch回0匹／0發送、raceday回not_final。只證明認證及安全略過，空清單不當通知成功案例。
- webhook錯secret回401。已核實direct authenticated DELETE不獲准，避免刪連結逃過Pro移除。

## 尚未完成／啟用的條件
- 缺會員Bot token、webhook secret及私人頻道ID／管理權限；不能驗真實/start token、轉寄邀請批核或到期移除。
- 缺VAPID public/private/subject；不能驗Chrome／iPhone真正推送。推送服務接受不等於裝置已顯示。
- 全部十一份完成前不發布，所以不設定指向未發布正式頁的webhook或啟動正式新job排程。啟用時Pro每小時、愛駒每小時:15、凍結提示每5分鐘，另核自然週期。
- 愛駒上游有馬匹的真實來源、私人通知失敗／恢復實送及舊cron憑證輪換仍待核；不把0匹job當有動態來源已驗。
- 第七份收款與後續驗收不在本輪；NOWPayments尚未接好，Crypto不開賣。
- 原文件setWebhook要求drop_pending_updates=true；本輪保留false，避免丟棄尚未處理的私人連結／批核，失敗回503供重試，不假報成功。
- GitHub只保存未發布草稿分支；不覆蓋正式main，不觸發模型升版、不改任何凍結或戰績。