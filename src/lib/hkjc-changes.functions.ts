import { createServerFn } from "@tanstack/react-start";
import type { HkjcChange } from "./hkjc-changes";

export type HkjcChangesSnapshot = { race_date: string; venue: string; fetched_at: string; source_url: string; sha256: string; changes: HkjcChange[] } | null;

export const getHkjcChanges = createServerFn({ method: "GET" })
  .inputValidator((d: { date: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d?.date ?? "")) throw new Error("賽日日期無效");
    return d;
  })
  .handler(async ({ data }): Promise<HkjcChangesSnapshot> => {
    const { setResponseHeader } = await import('@tanstack/react-start/server');
    setResponseHeader('Cache-Control', 'no-store');
    const { readLatestHkjcChanges } = await import("./hkjc-changes.server");
    return (await readLatestHkjcChanges(data.date)) as HkjcChangesSnapshot;
  });
