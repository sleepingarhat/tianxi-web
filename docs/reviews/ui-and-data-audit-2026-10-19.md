# 會員提示與賽事資料核對

- 註冊提示：戰績頁使用現有登入狀態，只在 signedIn=false 顯示；狀態載入／已登入皆隱藏。免費註冊連結指向 /auth?mode=signup，無權限變更。
- 市場「未能對照」：全場收市獨贏資料不全，或第4／5熱門同賠率，無法唯一選市場四匹；不當模型未命中。
- 真實來源：19/10已同步賽果表及 /api/meetings 僅4場，但 entries_upcoming 全11場有distance/post_time。只補會期匹配顯示欄，時間轉為香港HH:MM；不寫預測。
- 驗收：23項測試、API全11場時間途程、R11 17:50／1400m畫面通過；原SHA388f22b44e13e2124e46d3a703027025d401225725152879793b4578f148ce89不變，無頁面錯誤。登入本人預覽session mint失敗，未驗已登入流程。
- GitHub精確證據：[run39221923836](https://github.com/sleepingarhat/tianxi-racing/actions/runs/39221923836)，2026-10-19T08:19:12Z；直接下載logs：horse_profiles expected1187/present1183 missing4 stale12；horse_form_records missing4；trainer_profiles missing1。overall critical21 warn12。最終CRITICAL_COUNT21>2，exit1。不同日期summary不可取代此run log；未降低閘門、未聲稱補資料完成。
- 正式站未發布；原更易／會計／凍結前候選的未驗收限制不變。