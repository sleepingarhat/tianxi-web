# 獨立執行分工及成本核查（2026-10-19）

## 現況，不是已完成遷移
- Lovable Cloud 管理網站、會員、官方更易存檔及定時觸發；任務9–16及18仍觸發GitHub執行。任務18每5分鐘核實全日完場，首次確認後30分鐘觸發主收料。
- GitHub 目前仍執行Python／Chrome採集、SQLite Elo及LightGBM訓練；保留源碼、資料倉版本及後備。未有替代執行驗收前，不停用原工作流。
- Cloudflare D1仍由既有賽事讀取器使用；已核實Cloudflare連接與帳戶計費，沒有Containers。不能將Cloudflare說成完全未使用。
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

條件預算：假设2vCPU全程用滿、4GiB、8GB磁碟、每月9賽日各60–240分鐘及每日15分鐘輔助工作，運作後立即休眠；容器compute/memory/disk含量前gross約USD3.69–8.60／月，基本費另計；若從未付Paid基本費，兩者gross約USD8.69–13.60。未計額外Worker／Durable Objects、傳輸、儲存、稅及額外訓練；不是實際帳單或保證上限。GitHub實際Actions費未取得。Cloudflare帳戶最新10月帳單USD9.14、9月USD5、4月USD10.18；帳戶總額未取得逐項歸因，CLOSE不單獨证明付款收妥。Workers Paid固定USD5／月，目前只有tianxi-backend Worker，10/2–10/19請求56,376、errors0，無Containers。按USD1≈HKD7.8粗算，最新帳單約HK$71、固定月費約HK$39；不保證今期最終額。Lovable credits不能直接換算港元月費，未確認低於HK$200。

官方來源：https://developers.cloudflare.com/containers/pricing/ （本輪HTTP200核對）。

## 阻塞
- 本輪已核實馬會server-rendered results HTML：R1共13行、R11共14行，R11頭四8／13／7／6，2號K585無名次；parser及5項身份／退出測試通過。Cloud append-only原文／SHA表與lease已建立；直接收料接入候選及凍結只讀結果層，尚待完整保存→網站讀回驗收及發布。
- 每5分鐘單次最多收一場，若已有多場積壓會逐次追上，不能對積壓聲稱0–5分鐘；未知未完成馬匹先阻截、不猜退出。跨場派彩仍沿原來源。
- 相容獨立運算服務、帳戶存取與新增費用尚未確認。
- 逐場新流程、騎師lineage、跨場官方結算及首次30分鐘自動驗收仍未完成。

## 本輪真實讀回驗收
19:57 HKT已認證Cloud callback直接抓R1並存13行，SHA d899cd893df37d6b16d02509e5f572a9d1cfff3dfebee701c49776af329b5d45；預覽frozen-racing HTTP200讀回Cloud來源complete=true，原凍結388f22b…ce89不變。D1 horse_前綴作精確正規化，不同馬ID仍阻截，21項測試通過。匿名原文欄位讀取權限已撤回，只開精簡結果欄位。網頁戰績首屏仍載入中，未算完整UI驗收；新程式未發布、首個自動週期未驗收。
## 20:15最新驗收
2026-10-19 20:15：Cloudflare舊直連token回401，改已連接gateway後凍結API200、原SHA不變；戰績頁改讀原凍結metricInput，R8／R10剔除分母，R11原中3、補位另列，全日9場平均2.00／4。25測試過，桌面真實讀回通過。官方更易3份原文同步資料倉、manifest200及逐份SHA一致，Cloud每小時15分同步已建，首次自然週期待驗。未發布；訓練／評分需批准相容付費運算，騎師歷史與跨場結算缺可靠證據仍待核。

## 20:22配置提案（未建立）
用戶只批准先列配置，再確認建立；未新增付費資源或停用GitHub。官方規格更正：2vCPU／4GiB並不支援，建議單個standard-3（2vCPU／8GiB／16GB暫存碟）。假設每月990–2610分鐘、CPU全用及記憶體／磁碟全額、完成後停止，含量前約USD3.63–9.57（約HK$28–75），不是上限，另有控制請求、儲存與傳輸。現有Workers Paid USD5不重複計；包含額度共享、餘額未核，不承諾抵扣。磁碟非持久保存，工作完成須驗證外部存檔；Lovable統籌、Cloudflare執行、GitHub留版本與後備。完整配置及切換條件待確認，不影響現有網站或歷史凍結。

官方來源：
- https://developers.cloudflare.com/containers/platform/limits/
- https://developers.cloudflare.com/containers/pricing/
- https://developers.cloudflare.com/containers/container-class/
- https://developers.cloudflare.com/containers/concepts/architecture/
- https://developers.cloudflare.com/containers/configuration/scheduling-policy/

單價計算（USD）：每分鐘 `(2 × 60 × 0.000020) + (8 × 60 × 0.0000025) + (16 × 60 × 0.00000007)` = 0.0036672；990分鐘3.630528、2610分鐘9.571392。若Workers Paid全部375vCPU分鐘／25GiB小時／200GB小時包含額度仍可用，抵扣後約2.91–8.85；未核餘額，主預算不計抵扣。工作時長未量度，此為假設預算非現有帳單。
