# NOWPayments 收款驗收（2026-10-24）

## 已取得的服務證據
- 已儲存API Key、IPN Secret及Sandbox模式；僅確認存在，不顯示值或任何密鑰特徵。
- 首次向 `https://api-sandbox.nowpayments.io/v1/currencies` 發送帶API驗證的只讀請求：HTTP 403，服務錯誤分類 `INVALID_API_KEY`。
- 未呼叫正式收款服務，未建立invoice、未收款、未提交模擬IPN，未修改會員資格或開閘。

## 下一步及阻塞
### 20:16 HKT後現行決定（取代下列Sandbox要求）
- 用戶選擇小額正式驗收，不再註冊Sandbox；只讀正式 `/v1/currencies` 回HTTP200及有效幣種資料，證明目前API Key可用於正式服務，不證明IPN Secret一致或到帳。
- 正式 `/v1/min-amount` 只讀查詢均HTTP200：USDT TRC20最低約19.70美元；BSC約8.55美元、Polygon約8.63美元、Solana約9.02美元。這些為當次報價，不保證固定；建立付款前須重驗。
- 未建立付款、未改NOWPAYMENTS_SANDBOX設定、未改會員資格。待用戶選擇實際錢包網絡；擬BSC／Polygon／Solana 10美元或TRC20 25美元，需留手續費與最低額空間。
- 小額驗收必須獨立訂單／證據，不可以小額授予416美元52週資格；收費閘及Crypto公開銷售保持關閉。
- 用戶已選BSC（BEP20），固定10美元；0043新增獨立payment_acceptance_invoices，只允許管理員讀本人紀錄及服務端写入。新增管理設定面板、管理員server functions及獨立acceptance-ipn驗簽回呼；原Pro付款／資格RPC不改，服務端原子claim避免並行重複invoice，結果未明不重試付款建立。
- 尚未發布新回呼，不建立指向未發布回呼的invoice；待用戶發布批准。本人登入mint --self無匹配帳戶，管理員實際畫面與付款流程未驗。需本人預覽登入；付款後另核實平台Custody／錢包實際收款，不把finished本身當提領到帳。

### 歷史Sandbox路徑（不再執行）
1. 透過安全表單填入Sandbox帳戶的API Key；目前無效原因不能僅憑403確定，可能為錯環境或失效。
2. 核實Sandbox IPN Secret與測試帳戶一致；存在本身不證明一致。
3. 重驗只讀API成功後，隔離測試訂單及供應商付款／驗簽回呼／52週資格讀回；sandbox不可授予正式Pro。
4. 驗證重複回呼、不足額、退款及錯誤身份／環境；正式到帳需另外取得真實交易證據。

收費閘、Crypto及賽日提示不啟用，`membership_payment_environment=live`不修改。本輪只驗證服務及記錄，未發布。