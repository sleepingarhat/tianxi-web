# 暫封存內容（2026-10-13）

> 以下為2026-10-13封存驗收歷史，並非現時部署狀態。新版賽馬網站已發布；2026-10-24已用平台驗證天氣存檔、23:50同步及賽果派送，首次200後停用兩個舊天氣及舊賽果派送排程。舊產品只保存於私有研究，網站僅保留轉址／410。現行規則見賽馬藍圖。

現行平台只營運香港賽馬。六合彩原公開靜態程式移到 marksix-assets，不再由 public/ 對外提供；足球與六合彩頁面源碼保留，根路由返回首頁、API回410。歷史資料不刪不改。

資料庫足球鎖定／陣容表取消公開讀取，model_versions只公開racing。cron.alter_job 將 football-dual-lock（job3）、football-lineup-settle（job4）設active=false；weather兩項及race-results-dispatch保持active=true，已讀回核對。

GitHub兩倉均已讀回private=true、archived=true。尚未發布新版網站；權限與排程封存即時生效，正式站舊足球頁可能無資料，應於用戶下次「發」後一併更新。

驗證：封存規則4項通過、首頁1280/390無溢出無頁面錯誤、足球／六合彩頁返回首頁、3項API回410。已登入監控驗收未完成：auth-session無可匹配請求者帳戶，需要用戶在預覽登入。
