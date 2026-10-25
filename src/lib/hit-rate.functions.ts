// 單日對帳：瀏覽器唔再直接讀 Worker；伺服器帶唯讀憑證讀完整回應，再按會籍分級。
import { createServerFn } from "@tanstack/react-start";

export const getMeetingHitRate = createServerFn({ method: "GET" })
  .inputValidator((input: { date: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input?.date))) throw new Error("日期格式無效");
    return { date: input.date };
  })
  .handler(async ({ data }) => {
    const [{ workerFetch, WORKER_BASE }, { viewerTier }, { projectHitRate }, { horseDisplayDto }] = await Promise.all([
      import("./site-reader.server"), import("./picks-entitlement.server"), import("./hit-rate-projection"), import("./horse-name"),
    ]);
    const r = await workerFetch(`${WORKER_BASE}/api/analyze/hit-rate?date=${data.date}`, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`對帳資料暫時未能讀取（${r.status}）`);
    const body = horseDisplayDto(await r.json());
    return projectHitRate(body, await viewerTier()) as any;
  });
