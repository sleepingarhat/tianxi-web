// 登入身份轉換判斷：只有真正換咗帳戶（登入、登出、換人）先清走私人快取。
// 瀏覽器切返分頁時登入元件會再發一次 SIGNED_IN（同一個帳戶），唔應該清走畫面資料。

export type AuthCacheAction = "none" | "clear-private" | "sign-out";

/** undefined = 未有基準身份；null = 訪客 */
export type KnownIdentity = string | null | undefined;

export function authCacheAction(
  previous: KnownIdentity,
  event: string,
  nextUserId: string | null,
): { action: AuthCacheAction; identity: KnownIdentity } {
  if (event === "SIGNED_OUT") return { action: "sign-out", identity: null };
  if (event !== "INITIAL_SESSION" && event !== "SIGNED_IN" && event !== "USER_UPDATED" && event !== "TOKEN_REFRESHED") {
    return { action: "none", identity: previous };
  }
  // 第一次知道身份：讀取已經等登入初始化完成先發出，所以只記低基準。
  if (previous === undefined) return { action: "none", identity: nextUserId };
  if (previous === nextUserId) return { action: "none", identity: previous };
  return { action: nextUserId ? "clear-private" : "sign-out", identity: nextUserId };
}
