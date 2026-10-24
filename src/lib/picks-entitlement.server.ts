// 可選登入身份：有 Supabase Bearer 就核實並讀會籍；冇／無效一律當 guest（唔會報錯，保持訪客 UX）。
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Tier } from "./tiers";

export async function viewerTier(): Promise<Tier> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const header = getRequest()?.headers?.get("authorization") ?? "";
  const token = /^Bearer\s+(\S+)$/.exec(header)?.[1];
  if (!url || !key || !token || token.split(".").length !== 3) return "guest";
  try {
    const supabase = createClient<Database>(url, key, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getClaims(token);
    const sub = data?.claims?.sub;
    if (error || !sub) return "guest";
    const { loadUserTier } = await import("./tier.server");
    return (await loadUserTier(supabase, sub)).tier;
  } catch {
    // 會籍暫時核實唔到：當 registered 以下處理（只收窄，唔會放寬）
    return "guest";
  }
}
