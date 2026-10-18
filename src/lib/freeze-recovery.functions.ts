import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const entry = z.object({ date: z.string(), engine: z.string().optional(), checked_at: z.string(), ok: z.union([z.boolean(), z.number()]), action: z.string(), restored: z.number(), error: z.string().nullable().optional() });
const raceAudit = z.object({ date: z.string(), engine: z.string(), race_number: z.number(), checked_at: z.string(), expected: z.number(), actual: z.number(), ok: z.union([z.boolean(), z.number()]), fingerprint: z.string(), error: z.string().nullable() });
const response = z.object({ ok: z.boolean(), action: z.string(), date: z.string().optional(), checked_at: z.string().optional(), restored: z.number().optional(), error: z.string().nullable().optional(), fingerprint: z.string().nullable().optional(), history: z.array(entry).optional(), race_audits: z.array(raceAudit).optional() });

/** Public operational facts only; no prediction rows, credentials or member data. */
export const getFreezeRecoveryStatus = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const res = await fetch("https://tianxi-backend.tianxi-entertainment.workers.dev/api/analyze/freeze-recovery-status", { headers: { Accept: "application/json" }, cache: "no-store" });
    const data = response.parse(await res.json());
    if (!res.ok && data.ok) throw new Error("inconsistent-status");
    return { available: true, ...data };
  } catch {
    return { available: false, ok: false, action: "unavailable", error: "修復狀態暫時無法核實", history: [], race_audits: [] };
  }
});