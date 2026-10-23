# 天氣及舊賽果派送排程遷移驗收

2026-10-24 04:51 HKT。用戶04:44 HKT批准發布及遷移，確認Cloudflare tianxi-backend同值新密鑰已部署；沒有讀取或輸出密鑰。

## 新平台工作

| 名稱／ID | 正常UTC時間 | 入口 | 首次平台回應（20:50 UTC） |
| --- | --- | --- | --- |
| weather-archive-managed／27 | */5 * * * * | /api/public/jobs/weather-archive | 200，saved=0，無賽事（2026-10-24） |
| weather-sync-github-managed／28 | 50 15 * * * | /api/public/jobs/weather-sync-github | 200，rows=0，當日無天氣存檔 |
| race-results-dispatch-managed／29 | 31 15,17 * * * | /api/public/jobs/race-results-dispatch | 200，ok=true，capy_race_daily.yml已派送，deliveryVerified=false |

28及29先由結構化工具設定一次20:50 UTC平台驗收，回應後還原上表時間；27按正常五分鐘自然運行。28及29每小時最多兩次，平台可於指定分鐘後約30秒內分散執行。27不延遲；每天288次，保持原採樣時窗，沒有增加正常頻率，頻密工作會增加Cloud持續運作成本。

平台工具只收相對路徑；使用平台穩定正式目標，不手寫自訂domain HTTP SQL。正式自訂域名tianxi.racing三個新入口均核對未授權401；沒有以該未授權驗收冒稱工作執行。

## 舊工作

新工作回200後停用1 weather-archive-5min、2 weather-sync-github-nightly、5 race-results-dispatch；平台清單再讀回三項active=false。保留舊入口及歷史migration。舊天氣migration確認打預覽站及固定header；舊賽果時間由平台清單核實UTC15:31／17:31，現有hooks入口驗證x-cron-secret對WEATHER_CRON_SECRET。平台安全清單不提供該舊job資料庫URL／header；讀cron內部被平台拒絕，沒有繞過或猜測URL，不能證實該job原command實際header值。

賽果新jobs入口使用authenticateCronRequest，共用原固定workflow dispatch；date空、force=n，原hooks入口仍用原驗證。沒有改模型／凍結／戰績，派送接納不是完整收料驗收。

## 檢查

- 全套81檔441項測試通過；最新平台build OK。
- 正式三入口未授權401，dev-log新條目在瀏覽器可見。
- app_settings讀回membership_payment_environment=live、crypto_pass_enabled=false、raceday_alerts_enabled=false；沒有執行開閘操作。
- 首次HTTP回應來源net._http_response：21086存檔、21088賽果派送、21089同步；存檔同分鐘亦有舊排程回應21084，未以其中單個回應猜原URL。
- 源碼已於發布後同步GitHub tianxi-web（7bc66a3）；後續驗收文件及日誌再次同步。