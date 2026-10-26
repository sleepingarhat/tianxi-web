import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireTier } from "./tier.server";

const poolSchema = z.enum(["FF", "QUARTET", "TRIO", "ff", "quartet", "trio", "QTT", "TCE", "FIRST4"]);
const methodSchema = z.enum(["top_k", "banker_box"]).default("top_k");

const optimizeInput = z.object({
  pool: poolSchema,
  raceIds: z.array(z.string().trim().min(1).max(64)).min(1).max(12),
  budget: z.number().positive().max(1_000_000),
  method: methodSchema.optional(),
});

export type PoolComboRow = {
  raceId: string;
  pool: string;
  method: string;
  combination: string;
  horseNumbers: number[];
  legs: number;
  unitStake: number;
  bets: number;
  cost: number;
  modelHitProb: number;
  note: string;
};

export type PoolOptimizeResult = {
  pool: string;
  method: string;
  budget: number;
  raceIds: string[];
  combos: PoolComboRow[];
  totalCost: number;
  totalModelHitProbProxy: number;
  warnings: string[];
  model: string;
  disclaimer: string;
  researchBanner: string;
  scope: string;
  betUrl: null;
  placeBetUrl: null;
};

export const optimizeLabPools = createServerFn({ method: "POST" })
  .middleware([requireTier("pro")])
  .inputValidator((data: unknown) => optimizeInput.parse(data))
  .handler(async ({ data }): Promise<PoolOptimizeResult> => {
    const { workerFetch, WORKER_BASE } = await import("./site-reader.server");
    const r = await workerFetch(`${WORKER_BASE}/api/lab/pools/optimize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pool: data.pool,
        raceIds: data.raceIds,
        budget: data.budget,
        method: data.method ?? "top_k",
      }),
    });
    const body = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) {
      throw new Error(String(body["message"] ?? body["error"] ?? `優化失敗（${r.status}）`));
    }
    return body as unknown as PoolOptimizeResult;
  });
