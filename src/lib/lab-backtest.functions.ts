import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireTier } from "./tier.server";
import type { BacktestResultPayload } from "./lab-backtest";

const featureWeightSchema = z.object({
  id: z.string().min(1).max(40),
  weight: z.number().min(0).max(3),
  invert: z.boolean().optional(),
});

const backtestInput = z.object({
  features: z.array(featureWeightSchema).min(1).max(24),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pools: z.array(z.enum(["FF", "TRIO", "TIERCE", "QUARTET"])).min(1).max(4).optional(),
  valFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const hashInput = z.object({
  hash: z.string().regex(/^[a-f0-9]{16,64}$/i),
});

const compareInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const compareFullInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pools: z.array(z.enum(["FF", "TRIO", "TIERCE", "QUARTET"])).min(1).max(4).optional(),
  strategies: z
    .array(
      z.object({
        key: z.string().min(1).max(64),
        label: z.string().min(1).max(80),
        kind: z.enum(["official", "elo", "custom"]),
        features: z.array(featureWeightSchema).max(24).optional(),
      }),
    )
    .min(2)
    .max(4),
});

/** Pro：觸發自訂特徵回測（Worker /api/lab/backtest）。 */
export const runLabBacktest = createServerFn({ method: "POST" })
  .middleware([requireTier("pro")])
  .inputValidator((data: unknown) => backtestInput.parse(data))
  .handler(async ({ data }): Promise<{ hash: string; status: string; result: BacktestResultPayload; cached: boolean }> => {
    const { workerFetch, WORKER_BASE } = await import("./site-reader.server");
    const r = await workerFetch(`${WORKER_BASE}/api/lab/backtest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        features: data.features,
        from: data.from,
        to: data.to,
        pools: data.pools ?? ["FF", "TRIO", "TIERCE", "QUARTET"],
        valFrom: data.valFrom,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    if (r.status === 401) throw new Error("研究室服務憑證未就緒，請稍後再試");
    if (r.status === 400) {
      const body = (await r.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? "回測參數唔啱");
    }
    if (r.status === 503) {
      const body = (await r.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? "特徵矩陣未就緒（R2 待開）");
    }
    if (!r.ok) throw new Error(`回測暫時未能執行（${r.status}）`);
    return (await r.json()) as { hash: string; status: string; result: BacktestResultPayload; cached: boolean };
  });

/** Pro：輪詢回測結果。 */
export const getLabBacktest = createServerFn({ method: "GET" })
  .middleware([requireTier("pro")])
  .inputValidator((data: unknown) => hashInput.parse(data))
  .handler(async ({ data }): Promise<{ hash: string; status: string; result: BacktestResultPayload }> => {
    const { workerFetch, WORKER_BASE } = await import("./site-reader.server");
    const r = await workerFetch(`${WORKER_BASE}/api/lab/backtest/${encodeURIComponent(data.hash)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (r.status === 401) throw new Error("研究室服務憑證未就緒，請稍後再試");
    if (r.status === 404) throw new Error("搵唔到呢個回測結果");
    if (r.status === 400) {
      const body = (await r.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? "hash 唔啱");
    }
    if (!r.ok) throw new Error(`回測結果暫時未能讀取（${r.status}）`);
    return (await r.json()) as { hash: string; status: string; result: BacktestResultPayload };
  });

/** Pro：官方 vs Elo 最小對照（功能 2 stub）。 */
export const getLabBaselines = createServerFn({ method: "GET" })
  .middleware([requireTier("pro")])
  .inputValidator((data: unknown) => compareInput.parse(data))
  .handler(async ({ data }) => {
    const { workerFetch, WORKER_BASE } = await import("./site-reader.server");
    const qs = new URLSearchParams({ from: data.from, to: data.to });
    const r = await workerFetch(`${WORKER_BASE}/api/lab/compare/baselines?${qs}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (r.status === 401) throw new Error("研究室服務憑證未就緒，請稍後再試");
    if (!r.ok) throw new Error(`基線對照暫時未能讀取（${r.status}）`);
    return await r.json();
  });

/** Pro：完整策略比較器（Worker POST /api/lab/compare）。 */
export const runLabCompare = createServerFn({ method: "POST" })
  .middleware([requireTier("pro")])
  .inputValidator((data: unknown) => compareFullInput.parse(data))
  .handler(async ({ data }) => {
    const { workerFetch, WORKER_BASE } = await import("./site-reader.server");
    const r = await workerFetch(`${WORKER_BASE}/api/lab/compare`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        from: data.from,
        to: data.to,
        pools: data.pools ?? ["FF", "TRIO", "TIERCE", "QUARTET"],
        strategies: data.strategies,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    if (r.status === 401) throw new Error("研究室服務憑證未就緒，請稍後再試");
    if (r.status === 400) {
      const body = (await r.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? "比較參數唔啱");
    }
    if (r.status === 503) {
      const body = (await r.json().catch(() => null)) as { message?: string } | null;
      throw new Error(body?.message ?? "特徵矩陣未就緒（R2 待開）");
    }
    if (!r.ok) throw new Error(`比較器暫時未能執行（${r.status}）`);
    return await r.json();
  });
