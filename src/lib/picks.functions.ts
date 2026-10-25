// 天喜 · 全日預測（所有場次）
// 後端 /api/analyze/today-picks 對未認證訪客只回第一場，全日預測需帶管理員 token。
// Token 只存在伺服器端（TIANXI_ADMIN_TOKEN），永不落到瀏覽器。
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createPicksRefresh } from "./picks-refresh";
import { freezePublicationPending, freezePublicationDeadline } from './freeze-publication-window';
import { FrozenEvidenceError } from './frozen-racing';

const WORKER_BASE = "https://tianxi-backend.tianxi-entertainment.workers.dev";

// 不保存完成結果：避免凍結恢復後繼續公開舊初版或吞掉阻截錯誤。

export async function fetchTodayPicksUpstream() {
  const lockResponse = await fetch(`${WORKER_BASE}/api/analyze/lock-state`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  if (!lockResponse.ok) throw new Error('鎖定狀態暫未能核實');
  const lock = await lockResponse.json() as { date?: string; venue?: string; lockAt?: string; locked?: boolean; edition?: string };
  if (lock.locked || lock.edition === 'final' || lock.edition === 'unavailable') {
    if (!lock.date) throw new Error('凍結賽日未能核實');
    const { readFrozenRacing } = await import('./frozen-racing.server');
    try {
      return await readFrozenRacing(lock.date);
    } catch (error) {
      if (error instanceof FrozenEvidenceError && freezePublicationPending(lock.lockAt, error.code) && lock.lockAt) {
        return { date: lock.date, venue: lock.venue, lockAt: lock.lockAt, edition: 'pending', frozen: false, races: [], publicationDeadline: freezePublicationDeadline(lock.lockAt) };
      }
      throw error;
    }
  }
  const token = process.env["TIANXI_ADMIN_TOKEN"];
  const url = `${WORKER_BASE}/api/analyze/today-picks`;
  const { workerFetch } = await import('./site-reader.server');
  const res = await workerFetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(40_000),
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
  if (json?.races?.length) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(json.date ?? '') || !['ST', 'HV'].includes(json.venue)) throw new Error('預測賽日或馬場身份未能核實');
    const [{ publicRacingQuery }, { verifyRunnerIdentities }] = await Promise.all([import('./public-racing-evidence.server'), import('./racing-runner-identity')]);
    const card = await publicRacingQuery<import('./racing-runner-identity').RunnerIdentity>('SELECT race_number raceNumber,horse_number horseNumber,horse_id horseId FROM entries_upcoming WHERE race_date=? AND venue=? AND race_number>0', [json.date, json.venue]);
    verifyRunnerIdentities(json.races.flatMap((r: any) => (r.picks ?? []).map((p: any) => ({raceNumber:r.raceNumber,horseNumber:p.horseNumber,horseId:p.horseId}))), card, []);
  }
  return json;
}

const refreshPicks = createPicksRefresh(fetchTodayPicksUpstream);

export const getTodayPicksAll = createServerFn({ method: "GET" }).handler(async () => {
  const { setResponseHeader } = await import("@tanstack/react-start/server");
  setResponseHeader("Cache-Control", "no-store");
  const day = (await refreshPicks()) as import('./racing-shapes').DayPicks;
  // 一律喺伺服器按會籍投影（Pro 全日、其他人按 FEATURE_TIERS），唔再依賴 PRO_ENFORCEMENT 開關：
  // 上游用管理員 token 攞到全日資料，冇投影就直接交俾瀏覽器會洩漏賽前預測。
  const { projectDayPicksForViewer } = await import('./picks-projection');
  const { viewerTier } = await import('./picks-entitlement.server');
  return projectDayPicksForViewer(day, await viewerTier());
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
    const { workerFetch } = await import('./site-reader.server');
    const res = await workerFetch(url, {
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
    return json as import('./racing-shapes').DayPicks;
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
    return json as import('@/integrations/supabase/types').Json;
  });
