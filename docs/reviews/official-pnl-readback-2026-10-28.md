# 2026-10-28 官方資料及盈虧核查（現況補充）

本記錄取代本輪較早「補收未完成」及「六類尚未核實」觀察，不改原賽事證據。

## 舊賽果 D1
- 第一次工作 40653848172 因 races 缺 rating_range 全部23分塊失敗。
- PRAGMA 已核實 track、course 存在；新增 rating_range TEXT 空欄（未改已有資料）。
- 重跑 40660635485 成功，包括寫入與完成後檢查。
- 直接 D1 讀回2016-01-01至2026-10-27：8934場，rating_range仍有463空值，track 0空值。不宣稱100%評分覆蓋。
- 2026-10-25 ST R1、R2、R3：rating_range 分別60-40、40-0、60-40，track皆草地；原course字串保持。

## Wave4
- 工作40655944345已抓取並存GitHub（43e95646），但寫入失敗：空文字被emit_sql一律轉NULL，違反official_movement.from_loc NOT NULL。
- D1讀回：official_rating_weight 1451行、official_performance 1797行；movement、overoar、pool_result、draw_adv_stat均0行。不可當整批成功。
- 網站區塊已加入預覽，馬匹J218途程分頁真實8行；搬遷等未收錄明示空狀態。
- 後續收料修正須區分數字NULL與合法空文字，保留原CSV／SHA；修正後再跑既有工作，不能以示範資料填充。

## 盈虧故障
- 已重現：frozen-racing無副本回HTTP404 reason=no-archive；讀取端只識503，所以歷史賽日被當失敗。
- 跨場盈虧本來19/10/2026才起計，卻遍歷近90日所有賽日；起計前現在不再讀凍結／派彩。
- 真正驗證失敗仍拒絕結算；404而reason不是no-archive不能跳過。
- strategy-pnl與today改用useStrategyAccounting／combineStrategyAccounting，共用近90日六彩池合計及本人快取身份。
- DT／TT成本、正獎與安慰獎只加已核實非missing組口；缺證不估零、不重算凍結。錯誤保留重試，不能顯示未讀齊的完整總數。
- 本人登入驗收阻塞：--self無匹配帳戶，普通mint多帳戶；不自行挑選他人。用戶須登入預覽，或指明可驗收帳戶。

## 安全及發布
- 16:18及17:26 HKT基本掃描均無critical。
- 16:28 HKT深度結果6 warn、無critical，新增checkout返回網址警告；仍列舊已修項目。後續修改已令up_to_date=false，不冒称涵蓋最終改動。
- 未發布、未改密鑰／會籍／收費閘／Crypto／賽日提示／凍結。
- 完整正式本人盈虧讀回、Wave4後四類寫入、最終深度掃描覆核及發布仍未完成。