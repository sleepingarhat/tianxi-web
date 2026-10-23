import { isArchivedProductPath } from "./product-scope";

/** Only a local racing page can be used as a sign-in continuation. */
export function safeAuthNext(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return undefined;
  const path = value.split(/[?#]/)[0] ?? "";
  if (path === "/auth" || path === "/login" || path.startsWith("/api/") || isArchivedProductPath(path)) return undefined;
  return value;
}