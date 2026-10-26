import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireTier } from "./tier.server";

const venueSchema = z.enum(["ST", "HV"]);

const goingInput = z.object({
  venue: venueSchema,
  course: z.string().trim().max(16).optional(),
  distance: z.number().int().min(800).max(3200).optional(),
  going: z.string().trim().max(32).optional(),
  meetingId: z.string().trim().max(64).optional(),
});

const weatherInput = z.object({
  meetingId: z.string().trim().min(1).max(64),
});

export type LabGoingHeatCell = {
  draw: number;
  distance: number;
  runners: number;
  wins: number;
  top3: number;
  races: number;
  top3Rate: number | null;
  deltaVsAvg: number | null;
  sparse: boolean;
};

export type LabGoingPayload = {
  filters: {
    venue: string;
    course: string | null;
    distance: number | null;
    goingRequested: string | null;
    goingEffective: string | null;
    goingStatus: "ok" | "pending" | "fallback";
    fallbackGoing: string | null;
    since: string;
    meetingId: string | null;
  };
  heatmap: {
    draws: number[];
    distances: number[];
    cells: LabGoingHeatCell[];
    avgTop3Rate: number | null;
    minSample: number;
    totalRunners: number;
    totalRaces: number;
  };
  styleBias: {
    code: string;
    label: string;
    runners: number;
    wins: number;
    top3: number;
    winRate: number | null;
    top3Rate: number | null;
    deltaWinVsAvg: number | null;
    sparse: boolean;
  }[];
  suited: {
    horseId: string;
    horseNumber: number | null;
    nameCh: string | null;
    nameEn: string | null;
    draw: number | null;
    goingStarts: number;
    goingTop3Rate: number | null;
    overallTop3Rate: number | null;
    edgePp: number | null;
    tag: string;
  }[];
  suitedNote: string | null;
  notes: {
    disclaimer: string;
    research: string;
    pendingGoing: string | null;
    sparseRule: string;
  };
  metaGeneratedAt?: string;
  layer?: string;
  source?: string;
};

export type LabWeatherPayload = {
  meetingId: string;
  meeting: {
    date: string;
    venue: string;
    trackCondition: string | null;
    weather: string | null;
    totalRaces: number | null;
    goingStatus: "ok" | "pending";
    goingDisplay: string | null;
    lastSameVenueGoing: string | null;
  };
  snapshots: {
    meetingId: string;
    ts: string;
    temp: number | null;
    rh: number | null;
    rainMm: number | null;
    windDir: string | null;
    windKmh: number | null;
    soilMoisture: number | null;
    source: string | null;
  }[];
  weatherError: string | null;
  notes: {
    disclaimer: string;
    research: string;
    liveHint: string;
  };
  metaGeneratedAt?: string;
  layer?: string;
};

/** Pro 場地熱圖＋跑法偏差＋合地名單。 */
export const getLabGoing = createServerFn({ method: "GET" })
  .middleware([requireTier("pro")])
  .inputValidator((data: unknown) => goingInput.parse(data))
  .handler(async ({ data }): Promise<LabGoingPayload> => {
    const { workerFetch, WORKER_BASE } = await import("./site-reader.server");
    const q = new URLSearchParams();
    q.set("venue", data.venue);
    if (data.course) q.set("course", data.course);
    if (data.distance != null) q.set("distance", String(data.distance));
    if (data.going) q.set("going", data.going);
    if (data.meetingId) q.set("meetingId", data.meetingId);
    const r = await workerFetch(`${WORKER_BASE}/api/lab/going?${q.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    if (r.status === 401) throw new Error("研究室服務憑證未就緒，請稍後再試");
    if (r.status === 400) {
      const body = (await r.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "參數唔啱");
    }
    if (!r.ok) throw new Error(`場地資料暫時未能讀取（${r.status}）`);
    return (await r.json()) as LabGoingPayload;
  });

/** Pro 賽日天氣快照序列。 */
export const getLabWeather = createServerFn({ method: "GET" })
  .middleware([requireTier("pro")])
  .inputValidator((data: unknown) => weatherInput.parse(data))
  .handler(async ({ data }): Promise<LabWeatherPayload> => {
    const { workerFetch, WORKER_BASE } = await import("./site-reader.server");
    const r = await workerFetch(
      `${WORKER_BASE}/api/lab/weather/${encodeURIComponent(data.meetingId)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (r.status === 401) throw new Error("研究室服務憑證未就緒，請稍後再試");
    if (r.status === 404) {
      const body = (await r.json().catch(() => null)) as { message?: string; error?: string } | null;
      throw new Error(body?.message ?? body?.error ?? "搵唔到該賽日");
    }
    if (r.status === 400) {
      const body = (await r.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "參數唔啱");
    }
    if (!r.ok) throw new Error(`天氣快照暫時未能讀取（${r.status}）`);
    return (await r.json()) as LabWeatherPayload;
  });
