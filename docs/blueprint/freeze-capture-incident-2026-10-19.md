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

## 海報替代
- Postiz官方檔案上載 https://docs.postiz.com/public-api/uploads/upload-file 回傳id及path，供Postiz貼文image欄位引用，無須先上catbox。
- 未提供海報檔及Postiz授權，未代上載或代發；path不能假設為永久公開圖床網址。