# 凍結預測與官方賽果只讀 API

`GET https://tianxi.racing/api/public/frozen-racing?date=2026-10-19`

- 不傳date：香港今日；無效日期400。
- 200：`edition=final`、`frozen=true`；`snapshot`列SHA-256、145行／11場等實際數量、捕獲時間及鎖後延遲標記。
- `races[].predictedTop4`為凍結四揀馬號，`picks`為原始全場排名及分數。
- `races[].results`列官方馬匹、名次、最終獨贏賠率及走位；`resultsStatus=pending`表示未有賽果入帳，`available`不保證全場入帳完整。
- 缺可核實副本、修復未通過、SHA／原欄位／鎖點描述不一致：503、`edition=unavailable`，不讀臨場重算、不補寫歷史。
- 原始副本未保存pTop4，該欄回null，不另算入場排名；凍結pWin及pTop3照原值。
- 馬名及途程／時間只作現有身份／排位參考，並非原始凍結特徵。API無私人會員資料或密鑰，僅GET只讀；不需要派發管理token。
- 每次no-store讀取並驗證，不保存完成結果；選馬頁30秒重新核對、切回及重開即重取。
- 2026-10-19新增只讀身份關卡（預覽，正式站待發布）：按日期／馬場／場次／馬號對照 `entries_upcoming` 的 horse_id，同時核對已入帳官方賽果；缺排位、重複馬號／馬匹或身份不符一律503，不用現時馬名頂替原始預測。現版採全日阻截，未宣稱已做到只停單場。
- `identityCheck`僅證明與現有排位及已入帳賽果一致，不是鎖點前來源證明；`identityEvidence=current-card-cross-check-not-prelock-provenance`。賽後退賽／換馬也須核實，不能自動放行；`picks[].draw`只讀原始值，空字串回null，不補填。

發布狀態須以正式站實測為準；預覽200不等於已正式發布。