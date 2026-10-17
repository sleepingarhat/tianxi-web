/** 伺服器專用：重型公開計算結果暫存（只存可公開嘅衍生數據）。過期先重算，失敗時用舊結果。 */
export async function cached<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  let admin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"] | null = null;
  let stale: T | null = null;
  try {
    admin = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
    const { data, error } = await admin.from("computed_cache").select("payload, computed_at").eq("key", key).maybeSingle();
    if (error) throw new Error("暫存未能讀取");
    if (data) {
      stale = data.payload as T;
      const age = Date.now() - new Date(data.computed_at).getTime();
      if (Number.isFinite(age) && age >= 0 && age < ttlMs) return stale;
    }
  } catch { /* 暫存讀取失敗就直接計 */ }
  try {
    const fresh = await compute();
    if (admin) {
      const result = await admin.from("computed_cache").upsert({ key, payload: fresh as never, computed_at: new Date().toISOString() });
      if (result.error) console.error("Public computed cache write failed", result.error.message);
    }
    return fresh;
  } catch (e) {
    // Never silently present an expired snapshot as current after a failed refresh.
    // Old payload remains stored for recovery but the caller shows a read error.
    throw e;
  }
}
export const CACHE_TTL = 3 * 60 * 60 * 1000;
