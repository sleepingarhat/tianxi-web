import { createServerFn } from "@tanstack/react-start";
import type { OfficialFavourites } from "./official-favourites";

export type OfficialFavouritesSnapshot = { date: string; venue: string; races: OfficialFavourites[] };

/**
 * Read-only: official favourite order for a meeting, derived from archived
 * identity-verified HKJC result snapshots. Never recomputes or back-fills.
 */
export const getOfficialFavourites = createServerFn({ method: "GET" })
  .inputValidator((d: { date: string; venue: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d?.date ?? "")) throw new Error("賽日日期無效");
    if (!/^(ST|HV)$/.test(d?.venue ?? "")) throw new Error("馬場無效");
    return d;
  })
  .handler(async ({ data }): Promise<OfficialFavouritesSnapshot> => {
    const { setResponseHeader } = await import('@tanstack/react-start/server');
    setResponseHeader('Cache-Control', 'no-store');
    const { readOfficialFavourites } = await import("./official-favourites.server");
    return { date: data.date, venue: data.venue, races: await readOfficialFavourites(data.date, data.venue) };
  });
