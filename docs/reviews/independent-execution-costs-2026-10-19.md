# 獨立執行分工及成本核查（2026-10-19）

## 現況，不是已完成遷移
- Lovable Cloud 管理網站、會員、官方更易存檔及定時觸發；任務9–16及18仍觸發GitHub執行。任務18每5分鐘核實全日完場，首次確認後30分鐘觸發主收料。
- GitHub 目前仍執行Python／Chrome採集、SQLite Elo及LightGBM訓練；保留源碼、資料倉版本及後備。未有替代執行驗收前，不停用原工作流。
- Cloudflare D1仍由既有賽事讀取器使用；本輪沒有可用Cloudflare connector，未核實帳戶計費或建立Containers。不能將Cloudflare說成完全未使用。
- 現有網站執行環境不能啟動Python、Chrome、SQLite native程式或LightGBM訓練。多加觸發排程不能解除此限制。

## 可落實路線
1. 核實官方逐場完整賽果HTTP來源與解析器：現有官方GraphQL查詢只有場次狀態，不含完整名次或派彩。
2. 用現有Cloud排程統籌逐場收料與全日30分鐘核對；先保存原文／SHA、驗證馬匹身份及退出，才發布只讀結果。原凍結不改，派彩與賽果完整性分開。
3. 訓練及評分須另一個相容運算服務；Cloud安排及追蹤，獨立運算服務執行，GitHub只留版本與後備。尚未選定／建立服務，不能稱訓練已遷移。
4. 完成真實收料→資料倉→網站讀回、騎師歸因與訓練輸出驗收後才切換主執行者；缺證據停止並通知。

## 費用證據
2026-10-06 00:00 UTC至2026-10-19 11:43 UTC的完整返回紀錄（今天為部分日）：

|範圍|requested credits|recorded credit deductions|
|---|---:|---:|
|Cloud資料庫|25.935432|25.909499574|
|Cloud網站／functions|4.722595|4.722595|
|Cloud傳輸|0.006367692|0.006367692|
|上述Cloud合計|30.664394692|30.638462266|
|建立／修改網站及圖片|904.36404|904.26404|

上述不是港元或美元帳單；未取得發票及客戶資金條款，現金付款未知。AI usage另外3.16422 credits，不能歸因為模型訓練。

現有pico資料庫335 instance-hours；當前單價0.0774192 credits／instance-hour。如果單一instance連續運行720小時，僅compute估55.741824 requested credits／30日，未計其他用量、coverage及實際付款。本輪健康快照記憶體62%、連線7/60、磁碟14%，不是持續容量證據，未建議升降級。

Cloudflare Containers官方單價：CPU USD0.000020／vCPU-second，memory USD0.0000025／GiB-second，disk USD0.00000007／GB-second；Workers Paid基本費USD5／月。含量全帳戶共享，餘額未知。

條件預算：假设2vCPU全程用滿、4GiB、8GB磁碟、每月9賽日各60–240分鐘及每日15分鐘輔助工作，運作後立即休眠；容器compute/memory/disk含量前gross約USD3.69–8.60／月，基本費另計；若從未付Paid基本費，兩者gross約USD8.69–13.60。未計額外Worker／Durable Objects、傳輸、儲存、稅及額外訓練；不是實際帳單或保證上限。GitHub實際Actions費及Cloudflare既有帳單未取得。

官方來源：https://developers.cloudflare.com/containers/pricing/ （本輪HTTP200核對）。

## 阻塞
- 官方完整逐場賽果payload／parser及保存目的地未驗證。
- 相容獨立運算服務、帳戶存取與新增費用尚未確認。
- 逐場新流程、騎師lineage、跨場官方結算及首次30分鐘自動驗收仍未完成。