/**
 * Pro「我的策略」雲端 CRUD（研究層）。
 * 閘：requireTier('pro') — 同 lab 回測。
 * 表未 apply 時操作會失敗；前端應 fallback localStorage。
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireTier } from "./tier.server";
import { mapCloudStrategyRow, type PoolCode, type SavedStrategy } from "./lab-backtest";

const poolSchema = z.enum(["FF", "TRIO", "TIERCE", "QUARTET"]);
const weightSchema = z.object({
  id: z.string().min(1).max(40),
  weight: z.number().min(0).max(3),
  invert: z.boolean().optional(),
});

const upsertInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  note: z.string().max(500).optional(),
  weights: z.array(weightSchema).min(1).max(24),
  pools: z.array(poolSchema).min(1).max(4).optional(),
  lastBacktestHash: z.string().max(64).optional(),
});

const idInput = z.object({ id: z.string().uuid() });

type StrategyRow = {
  id: string;
  user_id: string;
  name: string;
  note: string;
  current_version: number;
  pools: string[];
  last_backtest_hash: string | null;
  created_at: string;
  updated_at: string;
};

type VersionRow = {
  strategy_id: string;
  version: number;
  weights: unknown;
  pools: string[];
};

/** 鬆散 client：migration 未入 types.ts 前用。 */
function strategiesDb(supabase: { from: (t: string) => any }) {
  return {
    strategies: () => supabase.from("user_strategies"),
    versions: () => supabase.from("user_strategy_versions"),
  };
}

async function loadWeightsFor(
  supabase: { from: (t: string) => any },
  rows: StrategyRow[],
): Promise<SavedStrategy[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const db = strategiesDb(supabase);
  const vers = await db
    .versions()
    .select("strategy_id,version,weights,pools")
    .in("strategy_id", ids);
  if (vers.error) throw new Error("策略版本暫時未能讀取");
  const latest = new Map<string, VersionRow>();
  for (const v of (vers.data ?? []) as VersionRow[]) {
    const prev = latest.get(v.strategy_id);
    if (!prev || v.version >= prev.version) latest.set(v.strategy_id, v);
  }
  return rows.map((r) => {
    const v = latest.get(r.id);
    const weights = Array.isArray(v?.weights) ? (v!.weights as SavedStrategy["weights"]) : [];
    return mapCloudStrategyRow({
      ...r,
      weights,
      pools: (v?.pools ?? r.pools) as string[],
    });
  });
}

/** Pro：列出帳號策略（含最新版權重）。 */
export const listUserStrategies = createServerFn({ method: "POST" })
  .middleware([requireTier("pro")])
  .handler(async ({ context }): Promise<{ strategies: SavedStrategy[]; source: "cloud" }> => {
    const db = strategiesDb(context.supabase);
    const list = await db
      .strategies()
      .select("*")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (list.error) throw new Error("策略清單暫時未能讀取（可能未 apply migration）");
    const strategies = await loadWeightsFor(context.supabase, (list.data ?? []) as StrategyRow[]);
    return { strategies, source: "cloud" };
  });

/** Pro：新建或更新策略（更新時 current_version+1 並寫 versions）。 */
export const upsertUserStrategy = createServerFn({ method: "POST" })
  .middleware([requireTier("pro")])
  .inputValidator((data: unknown) => upsertInput.parse(data))
  .handler(async ({ data, context }): Promise<{ strategy: SavedStrategy; source: "cloud" }> => {
    const db = strategiesDb(context.supabase);
    const pools: PoolCode[] = data.pools ?? ["FF", "TRIO", "TIERCE", "QUARTET"];
    const now = new Date().toISOString();

    if (data.id) {
      const existing = await db
        .strategies()
        .select("*")
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (existing.error) throw new Error("策略暫時未能讀取");
      if (!existing.data) throw new Error("搵唔到呢個策略");
      const prev = existing.data as StrategyRow;
      const nextVersion = (prev.current_version ?? 1) + 1;
      const upd = await db
        .strategies()
        .update({
          name: data.name.trim(),
          note: data.note ?? prev.note,
          current_version: nextVersion,
          pools,
          last_backtest_hash: data.lastBacktestHash ?? prev.last_backtest_hash,
          updated_at: now,
        })
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .select("*")
        .single();
      if (upd.error) throw new Error("策略未能更新");
      const ver = await db.versions().insert({
        strategy_id: data.id,
        version: nextVersion,
        weights: data.weights,
        pools,
      });
      if (ver.error) throw new Error("策略版本未能寫入");
      return {
        strategy: mapCloudStrategyRow({
          ...(upd.data as StrategyRow),
          weights: data.weights,
          pools,
        }),
        source: "cloud",
      };
    }

    const created = await db
      .strategies()
      .insert({
        user_id: context.userId,
        name: data.name.trim(),
        note: data.note ?? "",
        current_version: 1,
        pools,
        last_backtest_hash: data.lastBacktestHash ?? null,
      })
      .select("*")
      .single();
    if (created.error) throw new Error("策略未能建立（可能未 apply migration）");
    const row = created.data as StrategyRow;
    const ver = await db.versions().insert({
      strategy_id: row.id,
      version: 1,
      weights: data.weights,
      pools,
    });
    if (ver.error) throw new Error("策略版本未能寫入");
    return {
      strategy: mapCloudStrategyRow({ ...row, weights: data.weights, pools }),
      source: "cloud",
    };
  });

/** Pro：刪除策略（versions cascade）。 */
export const deleteUserStrategy = createServerFn({ method: "POST" })
  .middleware([requireTier("pro")])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = strategiesDb(context.supabase);
    const r = await db.strategies().delete().eq("id", data.id).eq("user_id", context.userId);
    if (r.error) throw new Error("策略未能刪除");
    return { ok: true };
  });

/** Pro：列出某策略所有版本。 */
export const listUserStrategyVersions = createServerFn({ method: "POST" })
  .middleware([requireTier("pro")])
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      versions: { version: number; weights: SavedStrategy["weights"]; pools: PoolCode[]; createdAt: string }[];
    }> => {
      const db = strategiesDb(context.supabase);
      const own = await db
        .strategies()
        .select("id")
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (own.error) throw new Error("策略暫時未能核實");
      if (!own.data) throw new Error("搵唔到呢個策略");
      const vers = await db
        .versions()
        .select("version,weights,pools,created_at")
        .eq("strategy_id", data.id)
        .order("version", { ascending: false });
      if (vers.error) throw new Error("版本清單暫時未能讀取");
      return {
        versions: (vers.data ?? []).map((v: any) => ({
          version: v.version as number,
          weights: (Array.isArray(v.weights) ? v.weights : []) as SavedStrategy["weights"],
          pools: (v.pools as PoolCode[]) ?? ["FF", "TRIO", "TIERCE", "QUARTET"],
          createdAt: v.created_at as string,
        })),
      };
    },
  );

/**
 * Pro：將本機策略批次 upsert 上雲（呼叫端先用 planLocalStrategiesMigration 揀）。
 * 唔會刪雲端；唔會清 localStorage（由 UI 明示）。
 */
export const migrateLocalStrategies = createServerFn({ method: "POST" })
  .middleware([requireTier("pro")])
  .inputValidator((data: unknown) =>
    z
      .object({
        strategies: z
          .array(
            z.object({
              name: z.string().min(1).max(80),
              note: z.string().max(500).optional(),
              weights: z.array(weightSchema).min(1).max(24),
              pools: z.array(poolSchema).min(1).max(4).optional(),
            }),
          )
          .max(50),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ migrated: SavedStrategy[]; skipped: number }> => {
    const migrated: SavedStrategy[] = [];
    let skipped = 0;
    for (const s of data.strategies) {
      try {
        // inline create（避免 serverFn 自呼叫）
        const db = strategiesDb(context.supabase);
        const pools: PoolCode[] = s.pools ?? ["FF", "TRIO", "TIERCE", "QUARTET"];
        const created = await db
          .strategies()
          .insert({
            user_id: context.userId,
            name: s.name.trim(),
            note: s.note ?? "",
            current_version: 1,
            pools,
          })
          .select("*")
          .single();
        if (created.error) {
          skipped++;
          continue;
        }
        const row = created.data as StrategyRow;
        const ver = await db.versions().insert({
          strategy_id: row.id,
          version: 1,
          weights: s.weights,
          pools,
        });
        if (ver.error) {
          skipped++;
          continue;
        }
        migrated.push(mapCloudStrategyRow({ ...row, weights: s.weights, pools }));
      } catch {
        skipped++;
      }
    }
    return { migrated, skipped };
  });
