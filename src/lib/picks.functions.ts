// 天喜 · 全日預測（所有場次）
// 後端 /api/analyze/today-picks 對未認證訪客只回第一場，全日預測需帶管理員 token。
// Token 只存在伺服器端（TIANXI_ADMIN_TOKEN），永不落到瀏覽器。
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createPicksRefresh } from "./picks-refresh";

const WORKER_BASE = "https://tianxi-backend.tianxi-entertainment.workers.dev";

// 不保存完成結果：避免凍結恢復後繼續公開舊初版或吞掉阻截錯誤。

async function fetchTodayPicksUpstream() {
  const lockResponse = await fetch(`${WORKER_BASE}/api/analyze/lock-state`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  if (!lockResponse.ok) throw new Error('鎖定狀態暫未能核實');
  const lock = await lockResponse.json() as { date?: string; locked?: boolean; edition?: string };
  if (lock.locked || lock.edition === 'final' || lock.edition === 'unavailable') {
    if (!lock.date) throw new Error('凍結賽日未能核實');
    const { readFrozenRacing } = await import('./frozen-racing.server');
    return readFrozenRacing(lock.date);
  }
  const token = process.env["TIANXI_ADMIN_TOKEN"];
  const url = `${WORKER_BASE}/api/analyze/today-picks`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "user-agent": "tianxi-web",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`預測服務回應異常（${res.status}）`);
  }
  if (json?.error && /賽馬日記錄不存在/.test(String(json.error))) {
    // 今日未有賽馬日：屬正常狀態，回空場次而唔係報錯
    const empty = { races: [], noMeeting: true, message: String(json.error) };
    return empty;
  }
  if (!res.ok || json?.error) throw new Error(json?.error || `預測服務錯誤 ${res.status}`);
  return json;
}

const refreshPicks = createPicksRefresh(fetchTodayPicksUpstream);

export const getTodayPicksAll = createServerFn({ method: "GET" }).handler(async () => {
  const { setResponseHeader } = await import("@tanstack/react-start/server");
  setResponseHeader("Cache-Control", "no-store");
  return (await refreshPicks()) as any;
});

/** 監控台用：可選強制重新運算（fresh=1，忽略快取） */
export const getOraclePicks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fresh?: boolean } | undefined) => ({ fresh: Boolean(data?.fresh) }))
  .handler(async ({ data, context }) => {
    const { data: role, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (error || !role) throw new Error("只限管理員使用監控工具");
    const token = process.env["TIANXI_ADMIN_TOKEN"];
    const url = `${WORKER_BASE}/api/analyze/today-picks${data.fresh ? "?fresh=1" : ""}`;
    const res = await fetch(url, {
      headers: {
        "user-agent": "tianxi-web-admin",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`預測服務回應異常（${res.status}）`);
    }
    if (!res.ok || json?.error) throw new Error(json?.error || `預測服務錯誤 ${res.status}`);
    return json as any;
  });

/** 回測工具：檔位因子倍數掃描（唯讀，唔會寫入生產設定） */
export const runDrawTune = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { from: string; to: string; scales: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data?.from ?? "")) throw new Error("from 格式錯");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data?.to ?? "")) throw new Error("to 格式錯");
    if (!/^[0-9,]{1,60}$/.test(data?.scales ?? "")) throw new Error("scales 格式錯");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: role, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (error || !role) throw new Error("只限管理員使用回測工具");
    const token = process.env["TIANXI_ADMIN_TOKEN"];
    const url = `${WORKER_BASE}/api/analyze/draw-tune?from=${data.from}&to=${data.to}&scales=${data.scales}`;
    const res = await fetch(url, {
      headers: {
        "user-agent": "tianxi-web-admin",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`draw-tune 回應異常（${res.status}）`);
    }
    if (!res.ok || json?.error) throw new Error(json?.error || `draw-tune 錯誤 ${res.status}`);
    return json as any;
  });
