import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { validateEntityId } from "./lab-entity-id";
import { requireTier } from "./tier.server";

const typeSchema = z.enum(["horse", "jockey"]);

const h2hInput = z
  .object({
    type: typeSchema,
    a: z.string().trim().min(1).max(64),
    b: z.string().trim().min(1).max(64),
    distance: z.number().positive().optional(),
    going: z.string().max(40).optional(),
    venue: z.enum(["ST", "HV"]).optional(),
  })
  .superRefine((val, ctx) => {
    if (!validateEntityId(val.type, val.a)) {
      ctx.addIssue({ code: "custom", path: ["a"], message: "對象 id 格式唔啱" });
    }
    if (!validateEntityId(val.type, val.b)) {
      ctx.addIssue({ code: "custom", path: ["b"], message: "對象 id 格式唔啱" });
    }
  });

const searchInput = z.object({
  type: typeSchema,
  q: z.string().min(1).max(40),
});

export type LabH2hPayload = {
  type: "horse" | "jockey";
  a: string;
  b: string;
  filters: { distance: number | null; going: string | null; venue: string | null };
  entities: {
    a: { id: string; nameCh: string | null; nameEn: string | null; code: string | null; status: string | null };
    b: { id: string; nameCh: string | null; nameEn: string | null; code: string | null; status: string | null };
  };
  elo: {
    a: { date: string; rating: number }[];
    b: { date: string; rating: number }[];
    meetings: { date: string; raceId: string; venue: string | null; raceNumber: number | null }[];
  };
  conditions: {
    key: string;
    label: string;
    a: { starts: number; wins: number; top3: number; avgPlace: number | null; sample: number; lowSample: boolean };
    b: { starts: number; wins: number; top3: number; avgPlace: number | null; sample: number; lowSample: boolean };
  }[];
  runningStyle: {
    a: {
      sample: number;
      lowSample: boolean;
      buckets: { code: string; label: string; count: number; share: number }[];
      earlyMedian: number | null;
      last400Avg: number | null;
    };
    b: {
      sample: number;
      lowSample: boolean;
      buckets: { code: string; label: string; count: number; share: number }[];
      earlyMedian: number | null;
      last400Avg: number | null;
    };
  };
  meetings: {
    date: string;
    raceId: string;
    venue: string | null;
    raceNumber: number | null;
    distance: number | null;
    going: string | null;
    a: { position: number | null; draw: number | null };
    b: { position: number | null; draw: number | null };
    ahead: "a" | "b" | "tie" | null;
  }[];
  warnings: string[];
  meta?: { rowCounts?: { a: number; b: number }; generatedAt?: string };
};

export type LabSearchItem = {
  id: string;
  nameCh: string | null;
  nameEn: string | null;
  code: string | null;
  status: string | null;
};

/** Pro 頭對頭：經 workerFetch 帶 site secret 叫 Worker。 */
export const getLabH2h = createServerFn({ method: "GET" })
  .middleware([requireTier("pro")])
  .inputValidator((data: unknown) => h2hInput.parse(data))
  .handler(async ({ data }): Promise<LabH2hPayload> => {
    const { workerFetch, WORKER_BASE } = await import("./site-reader.server");
    const qs = new URLSearchParams({ type: data.type, a: data.a, b: data.b });
    if (data.distance != null) qs.set("distance", String(data.distance));
    if (data.going) qs.set("going", data.going);
    if (data.venue) qs.set("venue", data.venue);
    const r = await workerFetch(`${WORKER_BASE}/api/lab/h2h?${qs}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (r.status === 401) throw new Error("功能服務憑證未就緒，請稍後再試");
    if (r.status === 404) throw new Error("搵唔到其中一個對象");
    if (r.status === 400) {
      const body = (await r.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "參數唔啱");
    }
    if (!r.ok) throw new Error(`頭對頭資料暫時未能讀取（${r.status}）`);
    return (await r.json()) as LabH2hPayload;
  });

/** Pro 功能頁搜尋（馬／騎師）。 */
export const searchLabEntity = createServerFn({ method: "GET" })
  .middleware([requireTier("pro")])
  .inputValidator((data: unknown) => searchInput.parse(data))
  .handler(async ({ data }): Promise<{ type: "horse" | "jockey"; items: LabSearchItem[] }> => {
    const { workerFetch, WORKER_BASE } = await import("./site-reader.server");
    const qs = new URLSearchParams({ type: data.type, q: data.q });
    const r = await workerFetch(`${WORKER_BASE}/api/lab/search?${qs}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (r.status === 401) throw new Error("功能服務憑證未就緒，請稍後再試");
    if (!r.ok) throw new Error(`搜尋暫時未能完成（${r.status}）`);
    return (await r.json()) as { type: "horse" | "jockey"; items: LabSearchItem[] };
  });
