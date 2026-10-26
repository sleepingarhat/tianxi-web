import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireTier } from "./tier.server";

const raceIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(
    (v) => {
      const id = v.startsWith("race_") ? v : `race_${v}`;
      return /^race_\d{4}-\d{2}-\d{2}_(ST|HV)_\d+$/.test(id);
    },
    { message: "raceId 格式唔啱" },
  )
  .transform((v) => (v.startsWith("race_") ? v : `race_${v}`));

const paceInput = z.object({ raceId: raceIdSchema });

export type LabPaceSection = {
  sectionNumber: number;
  distance: number | null;
  raceTime: number | null;
  classMedian: number | null;
  deltaVsMedian: number | null;
};

export type LabPaceRunner = {
  horseId: string;
  horseNumber: number | null;
  nameCh: string | null;
  nameEn: string | null;
  draw: number | null;
  finishingPosition: number | null;
  runningPosition: string | null;
  positions: (number | null)[];
  times: (number | null)[];
  role: string | null;
  roleLabel: string | null;
  pickRank: number | null;
  highlight?: boolean;
};

export type LabPacePayload = {
  raceId: string;
  meta: {
    date: string;
    venue: string | null;
    raceNumber: number | null;
    class: string | null;
    distance: number | null;
    going: string | null;
    track: string | null;
    course: string | null;
  };
  hasSectionals: boolean;
  sections: LabPaceSection[];
  runners: LabPaceRunner[];
  paceIndex: {
    early: number | null;
    mid: number | null;
    late: number | null;
    label: "快" | "中" | "慢" | null;
    source: "computed" | "profile" | "none";
  };
  notes: {
    disclaimer: string;
    research: string;
    missingSectionals: string | null;
  };
  metaGeneratedAt?: string;
};

export type LabPaceForecastPayload = {
  raceId: string;
  meta: {
    date: string;
    venue: string | null;
    raceNumber: number | null;
    class: string | null;
    distance: number | null;
    going: string | null;
  };
  styleMix: {
    total: number;
    known: number;
    buckets: { code: string; label: string; count: number; share: number }[];
    nLeaders: number;
  };
  forecast: "快" | "中" | "慢";
  rationale: string;
  rule: string;
  disclaimer: string;
  researchNote: string;
  drawStyle: {
    draw: number;
    style: string;
    styleLabel: string;
    horseId: string;
    horseNumber: number | null;
    nameCh: string | null;
  }[];
  runners: {
    horseId: string;
    horseNumber: number | null;
    nameCh: string | null;
    draw: number | null;
    style: string | null;
    styleLabel: string;
    sampleCount: number;
  }[];
};

/** Pro 已完場分段＋走位。 */
export const getLabPace = createServerFn({ method: "GET" })
  .middleware([requireTier("pro")])
  .inputValidator((data: unknown) => paceInput.parse(data))
  .handler(async ({ data }): Promise<LabPacePayload> => {
    const { workerFetch, WORKER_BASE } = await import("./site-reader.server");
    const r = await workerFetch(`${WORKER_BASE}/api/lab/pace/${encodeURIComponent(data.raceId)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (r.status === 401) throw new Error("研究室服務憑證未就緒，請稍後再試");
    if (r.status === 404) throw new Error("搵唔到該場賽事");
    if (r.status === 400) {
      const body = (await r.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "參數唔啱");
    }
    if (!r.ok) throw new Error(`走位資料暫時未能讀取（${r.status}）`);
    return (await r.json()) as LabPacePayload;
  });

/** Pro 今場跑法組成＋節奏研究提示。 */
export const getLabPaceForecast = createServerFn({ method: "GET" })
  .middleware([requireTier("pro")])
  .inputValidator((data: unknown) => paceInput.parse(data))
  .handler(async ({ data }): Promise<LabPaceForecastPayload> => {
    const { workerFetch, WORKER_BASE } = await import("./site-reader.server");
    const r = await workerFetch(
      `${WORKER_BASE}/api/lab/pace-forecast/${encodeURIComponent(data.raceId)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (r.status === 401) throw new Error("研究室服務憑證未就緒，請稍後再試");
    if (r.status === 404) {
      const body = (await r.json().catch(() => null)) as { message?: string; error?: string } | null;
      throw new Error(body?.message ?? body?.error ?? "搵唔到該場或尚未有名單");
    }
    if (r.status === 400) {
      const body = (await r.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "參數唔啱");
    }
    if (!r.ok) throw new Error(`節奏提示暫時未能讀取（${r.status}）`);
    return (await r.json()) as LabPaceForecastPayload;
  });
