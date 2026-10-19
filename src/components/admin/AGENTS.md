# 監控端組件規則

- 監控端 /admin 為側欄佈局（src/routes/_authenticated/admin.tsx），各頁用 src/components/admin/kit.tsx 嘅 AdminHead／Panel／Kpi／StatusBadge／DataTable（TanStack Table），圖表用 EChart；深色主題只喺 .tx-admin 範圍覆寫 --tx-* 變數。理由：前台品牌唔受影響，監控頁唔再逐頁漂移。
- Demo／Worst case 假資料只經 src/components/admin/fixtures.tsx 嘅 useFixture，並以 import.meta.env.DEV 把關。理由：break-ui 驗收要可重現，正式站唔可以出假數。
- Admin engine-health consumers share a display-only language adapter in the admin data hook; preserve response keys and source records so terminology edits cannot change monitoring logic.
- Console read/action panels share console-data; routes retain auth guards. Why: smaller files without changing permissions or endpoints.
