# 2026-10-21 17:53 HKT 收尾與未來验收

## 現在完成的修正
- 官方賽事倒數用香港UTC+8，不再採用訪客瀏覽器時區。
- 本輪發布包含T90→T60單純no-archive等待與預測空回應守門；原鎖點及SHA不改。
- 更易預檢例外回502；續期心跳結果失敗不可回報核實成功。
- 全日完場後30分鐘主收料要求直接回傳runId，保存於非公開運維state；現有五分鐘callback只查自己run，成功且所有預期場號官方身份存檔齊先記delivery verified。這不證明D1、派彩、Elo及模型訓練完成；沒有回傳runId則明示未核實，不以時間配對，不反覆派送已接受工作。
- 舊賽果派送hook加30秒上限與中文失敗回應；頁面例外中文重載最新版本，非白畫面根因修復證據。

## 直接工具查核
- Managed schedules：hkjc-changes minute active；racing-results-completion-check */5 active；賽後D1及Elo既有工作active，保留GitHub後備、不新增付費運算。
- 研究續跑39568210954：GitHub返回in_progress；81個grid jobs中78 success，74／77／80尚in_progress；最後30日evaluate未出現，不更新結果／不升版。
- Telegram getMe成功＝天喜引擎@tianxienginebot；已保存告警收件人getChat回400 chat not found；公開@tianxi_racing getChat200，但sendMessage403 bot is not a member。不把可讀當可發；不得擅自改私有運維告警送公開頻道。
- 本人auth-session --self失敗：無匹配帳戶；不任揀其他會員，監控登入內容未驗。
- 安全重掃完成：1 warning、6 info，無critical；有一項掃描因未配置連接而略過，不稱完整零風險。

## 未完成與阻塞
1. T90當刻獨立不可改寫存證／card→公告→重算revision全鏈：欠17:10及17:15執行日誌與來源綁定，不能倒造今日證據。公開副本現可讀≠準時鎖定已驗。
2. Telegram：本輪正式受認證測試HTTP200及test.sent=true，現有私人告警已成功送訊；不轉公開，亦不等同已讀。GitHub賽前／賽後頻道通知仍待獨立驗收；正確發送機器人須有現行頻道發訊權限，兩個機器人不因名稱相似而視為同一身份。
3. 今日賽後：賽事尚未開跑；由已啟用排程實際收料並記錄交付。不設助手離線回訪承諾。
4. 第四步：缺真正鎖後換騎案例、退出／started-DNF／finished逐匹訓練產物與SHA、actual/frozen騎師lineage、退款／並頭／特殊組合全票官方對帳。已發現訓練COUNT缺口，不直接改正式Elo。
5. 三模型：等外部工作完成所有81組及最後30日一次過評估，再核實summary與逐場檔案；未完成不填成績。
6. 白畫面及已登入監控：無本人測試session及未重現根因，只核公開流程。

未來收料由部署後的既有工作執行；未有程式及證據支持的全面驗收不自動勾完成，仍需後續核查。

## 本輪Cloudflare權限與私人告警重驗
- 部署39583408466日誌：程式已上傳，隨後account層workers/scripts/tianxi-backend/routes讀取被拒絕，不能把zone路由讀取成功當部署已成功。
- 兩個Lovable Cloudflare連接均可讀tianxi.racing現有十條路由；新連接同一account層routes亦HTTP200。GitHub workflow實際使用CF_API_TOKEN，secret中繼資料最後更新2026-05-02，並未自動採用新Lovable連接。不能讀取或代為增權GitHub保存的原始金鑰。
- 修復阻塞：擁有人更新tianxi-racing GitHub Actions的CF_API_TOKEN，使其涵蓋正確account及tianxi.racing zone，具Workers Scripts Edit及Workers Routes Edit，再完整重跑backend_deploy.yml。不移除路由步驟繞過拒絕、不擅改路由、不搬移私人憑證。
- Cloudflare現行版本部署時間2026-10-21T10:17:43.534Z、流量100%；正式engine-health的display_odds_freshness PASS。證明現行程式可用，不證明GitHub部署流程已完整成功。
- 正式/api/public/telegram-alert?test=1以現有排程密鑰測試：HTTP200，test.sent=true/detail=sent。檢查本身沒有需要送出的告警，所以頂層sent=false不代表測試失敗；兩者必須分開讀。