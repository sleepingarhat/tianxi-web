# 天喜 TIANXI · 香港賽馬

[![馬場海報監察](https://github.com/sleepingarhat/tianxi-web/actions/workflows/racecourse-photos-monitor.yml/badge.svg)](https://github.com/sleepingarhat/tianxi-web/actions/workflows/racecourse-photos-monitor.yml)
[![正式站健康監察](https://github.com/sleepingarhat/tianxi-web/actions/workflows/site-health-monitor.yml/badge.svg)](https://github.com/sleepingarhat/tianxi-web/actions/workflows/site-health-monitor.yml)

2026-10-13 起專注深耕香港賽馬：沙田、跑馬地。正式站：https://tianxi.racing

## 產品及免費路線
- 每賽日首場前 90 分鐘凍結全日四揀及第五選；鎖後只接官方名次，不改預測。
- 選馬、排位／賠率、預測與賽果、六彩池策略盈虧、公開戰績、百科、回測、引擎健康。
- 主指標四揀平均中匹數，目標 3／4；市場熱門 2.31 作對照，不宣稱已達標，負數如實展示。
- 現階段註冊會員免費享現有 Pro 功能；創始門檻首200名，開閘日起贈52週 Pro（HK$4,056）。達門檻不自動開閘，須付款驗收及用戶明確批准；iOS App 尚未推出，公開對帳永久免費。
- Stripe：HK$78／週自動續訂；加密貨幣：US$416／52週一次付款（展示HK$3,244.80八折），不自動續期。收款及通知實際驗收未完成，不宣稱已可購買。

## 架構及倉庫
- tianxi-racing：現行賽馬資料、服務及排程。
- tianxi-web：現行源碼鏡像，正式站由 Lovable 發布。
- tianxi-research：賽馬研究；研究先報告、用戶拍板先升版。
- tianxi-football／tianxi-marksix：private＋archived，保留歷史資料及源碼，取消前台及監控服務。
- TanStack Start／React 19、Tailwind v4、Lovable Cloud、ECharts、TanStack Table；/admin 只限管理員。
- 現行藍圖及前後端設計：docs/blueprint/tianxi-racing-blueprint-2026-10-13.md；兩份互動腦圖在 public/mindmap。
- App／favicon 統一翠綠金色喜字與馬。馬場圖片授權见 /media-credits。

## 驗收
封存路徑自動測試：`bunx vitest run src/lib/product-scope.test.ts`；全站矩陣：`npm run test:break-ui`。公開頁通過不等於已登入監控端驗收。舊文件及開發日誌只作歷史，不代表現行範圍。
