import { requireTier } from "./tier.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const listFeatureRaces = createServerFn({ method: "GET" })
  .middleware([requireTier("registered")])
  .inputValidator((data: unknown) => z.object({ date: z.string().optional() }).parse(data ?? {}))
  .handler(async ({ data }) => {
    const { listRaces } = await import("./features.server");
    return listRaces(data.date);
  });

export const getFeatureRace = createServerFn({ method: "GET" })
  .middleware([requireTier("registered")])
  .inputValidator((data: unknown) => z.object({ raceId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { buildFeatureRace } = await import("./features.server");
    return buildFeatureRace(data.raceId);
  });
