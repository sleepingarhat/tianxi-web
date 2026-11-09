/**
 * 模型來源判斷：後端有兩種寫法——"lgb"，或描述字串如 "tx-oracle-v3 (lgb=12/12, …)"。
 * 只要 lgb= 後面覆蓋匹數大過 0 就係天喜LGB；冇資料唔當作基準。
 */
export function isLgbScoreSource(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (value.trim().toLowerCase() === "lgb") return true;
  const m = value.match(/lgb=([0-9]+)/i);
  return Boolean(m && Number(m[1]) > 0);
}
