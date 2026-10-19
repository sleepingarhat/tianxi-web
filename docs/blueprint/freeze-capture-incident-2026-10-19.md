# 2026-10-19 沙田凍結擷取故障

## 已核實
- 正式庫145行baseline/v12預測存在，生成00:48:21.522 UTC，鎖點03:00 UTC；描述寫入00:48:22.993 UTC。
- 原始副本表沒有當日副本；145行存在不等同恢復驗收。
- SQLite JSON輸出1.0，JavaScript JSON輸出1；145行解析後值相同。捕獲文字比對因此誤判concurrent-capture-retry。

## 修復
- 捕獲INSERT交易內核對總行數及逐欄NULL-safe值相等，按主鍵查原始行，不比較JSON格式。
- 不UPDATE／DELETE預測或描述，不以臨場預測替换；原始副本SHA及trigger保留。
- 正式REAL affinity回歸、13項恢復及5項逐場保護測試通過；既有部署流程加入恢復回歸。
- 首次修復部署36a3eaf成功，隨後接口出現D1 overloaded，繼續核實，不冒稱已恢復。

## 正式讀回驗收
- 修復061d106部署成功；原有排程13:25:15 HKT保存145行／11場副本，SHA-256核實通過：388f22b44e13e2124e46d3a703027025d401225725152879793b4578f148ce89。
- 部署前後145行全欄位及完整描述一致；11場馬匹數／排名／指紋巡查全部通過，restored=0，沒有重寫或補預測。
- 正式網站lock-state HTTP200 edition=final；後端today-picks、freeze-ledger及修復狀態HTTP200；健康freeze_recovery PASS。
- 副本為鎖點後延遲捕獲，原行生成早於鎖點；沒有11:00當刻獨立副本，不能聲稱已證明從11:00起從未變動。
- 正式庫未刪行製造故障；缺行恢復仍為隔離測試驗收，今次實跑驗證的是捕獲及11場巡查。

## 前端讀回修正（已正式驗收）
- 後端final不等於頁面已讀到final；getTodayPicksAll舊資料快取可沿用初版15分鐘，且背景錯誤被吞掉。
- 今日預測只合併同時讀取、不保存完成結果；上游及回應no-store，失敗不回舊版。選馬頁30秒重取、重新打開及切回即核對。
- 這份預測edition／frozen才可确认最終版，時間及另一份lock-state不可代證；保留上游開跑時間，沒有修改預測或模型。
- 正式站需發布後核對最終標籤及11場；未核實前不可通知製作最終海報。
- 實測真正狀態差異：未認證today-picks回frozen=true／edition=final（1場），管理token全11場回應卻沒有frozen／edition，不能單靠取消快取修正。
- 新增GET `/api/public/frozen-racing?date=2026-10-19`：只SELECT不可變副本、核實SHA-256、逐欄對照prediction_log、核對描述及修復狀態，再配官方race_results；不運算、不捕獲、不修復、不寫入。
- 選馬頁鎖後亦改用同一只讀函數；缺副本或任何核對失敗回503／unavailable，不把歷史無副本紀錄冒充驗收。
- 原始副本未保存pTop4，因此新API該欄null並明示not-saved-in-original，不能借現時估值補作凍結入場機率；馬名只作現有身份參考。
- 賽果逐場pending／available，只表示入帳資料是否存在，不冒称全部賽果齊全。捕獲時間及鎖後延遲標記保留。
- 正式發布後實測/api/public/frozen-racing HTTP200、no-store、edition=final、145行／11場及原SHA相同；正式/predictor瀏覽器確認最終版與R11、零頁面錯誤。16項回歸全過；手機無溢出、缺歷史副本503、無效日期400。

## 海報替代
- Postiz官方檔案上載 https://docs.postiz.com/public-api/uploads/upload-file 回傳id及path，供Postiz貼文image欄位引用，無須先上catbox。
- 未提供海報檔及Postiz授權，未代上載或代發；path不能假設為永久公開圖床網址。